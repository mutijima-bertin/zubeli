/**
 * Postgres-backed token-bucket rate limiter (ADR 0002).
 *
 * Buckets live in the `RateLimitBucket` table (`key`, `tokens`, `updatedAt`),
 * NOT in process memory: on Vercel every serverless instance gets its own
 * ephemeral heap, so the old in-process `Map` gave each instance a private,
 * full set of buckets and the limit was effectively never reached. The database
 * is now the ONLY synchronisation point — refill and consume run in a single
 * `INSERT ... ON CONFLICT DO UPDATE ... WHERE <bucket has a token>` statement,
 * so two concurrent instances racing for the last token serialise on the row
 * lock and exactly one of them consumes it (Postgres re-evaluates the `WHERE`
 * against the row version it actually obtains, i.e. after the winner commits).
 * There is no in-process locking and none is needed.
 *
 * The elapsed-time refill term is clamped at zero (`GREATEST(0, …)`) because
 * that same transaction-scoped `NOW()` can arrive EARLIER than the `updatedAt`
 * the winner committed; see `consumeToken`.
 *
 * FAIL OPEN: if the database is unreachable or errors for any reason the
 * request is ALLOWED and a warning is logged. A limiter outage must never 500
 * a customer who is trying to pay for an order — abuse protection degrades to
 * "off" instead of trading availability for it.
 *
 * Keys are opaque strings built by callers: `register:${ip}`,
 * `login:${ip}:${email}`, `checkout:${ip}:${cartId}`. The API is async because
 * a bucket is a database row — every call site awaits.
 */
import { Prisma } from '@prisma/client';
import { RateLimitError } from '@/lib/errors';
import { prisma } from './db';

export type RateLimitOptions = {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/** Defaults from ADR 0002 (env-tunable later; document when scaling). */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 }, // per IP + email
  register: { limit: 5, windowMs: 60 * 60 * 1000 }, // per IP
  checkout: { limit: 10, windowMs: 60 * 60 * 1000 }, // per IP + cart
} as const;

/**
 * Prune TTL = the LONGEST configured window. A bucket younger than this can
 * still hold live tokens for at least one route, so it is never eligible for
 * deletion. Because `updatedAt` only advances when a whole token accrues, a
 * bucket older than the longest window is fully refilled for every route —
 * deleting it is equivalent to letting it expire, since the next take inserts a
 * fresh bucket with the same starting balance. The login key embeds an
 * attacker-chosen email (`login:${ip}:${email}`), so without this prune an
 * attacker could mint unlimited unique rows (storage-exhaustion vector).
 */
export const RATE_LIMIT_MAX_WINDOW_MS = Math.max(
  ...Object.values(RATE_LIMITS).map((r) => r.windowMs),
);

/** Rows removed per prune call — keeps each opportunistic cleanup bounded. */
export const RATE_LIMIT_PRUNE_BATCH = 500;

/**
 * Probability gate: ~1 in N successful takes triggers a prune, so the hot path
 * pays for cleanup at most once per N writes instead of on every request.
 */
const PRUNE_ONE_IN = 1000;

/**
 * Delete one bounded batch of buckets whose last write is older than
 * RATE_LIMIT_MAX_WINDOW_MS. Concurrency-safe: the `ctid IN (SELECT … LIMIT)`
 * form atomically deletes a bounded set; two serverless instances pruning at
 * once may target the same rows, but deleting an already-deleted row is a no-op
 * (no error). Postgres-only by design (deployment target is Neon).
 */
export async function pruneStaleBuckets(): Promise<number> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_MAX_WINDOW_MS);
  return prisma.$executeRaw`
    DELETE FROM "RateLimitBucket"
    WHERE ctid IN (
      SELECT ctid FROM "RateLimitBucket"
      WHERE "updatedAt" < ${cutoff}
      LIMIT ${RATE_LIMIT_PRUNE_BATCH}
    )
  `;
}

/**
 * Opportunistic, fail-soft prune. Never throws: a cleanup failure (or a DB
 * hiccup) must not turn a limiter call into a request failure — the limiter is
 * fail-open by design. Errors are swallowed with a warning.
 */
async function maybePruneStaleBuckets(): Promise<void> {
  if (Math.random() >= 1 / PRUNE_ONE_IN) return;
  try {
    await pruneStaleBuckets();
  } catch (error) {
    console.warn('[zubeli] rate-limit prune skipped (db unavailable):', error);
  }
}

type BucketRow = { remainingTokens: number; updatedAt: Date };

/**
 * Refill + consume in ONE atomic statement.
 *
 * - No row yet → insert a full bucket minus the token consumed now.
 * - Row exists → refill proportionally to elapsed time (`updatedAt` only moves
 *   forward when a whole token accrued, exactly like the old in-memory bucket),
 *   and the `WHERE` gate makes the UPDATE a no-op (zero rows returned) when the
 *   refilled bucket is empty — that is the "blocked" signal.
 *
 * The refill term is `floor(elapsedMs / windowMs * limit)` — the same formula
 * the in-memory limiter used — hence `EXTRACT(EPOCH ...)` (seconds) scaled by
 * 1000 before it is divided by the millisecond window.
 */
async function consumeToken(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  // Refill term and the resulting balance are built ONCE and interpolated into
  // every place they are needed (the SET, the "updatedAt" CASE and the WHERE
  // gate) so the three copies can never drift apart.
  //
  // GREATEST(0, …) is MANDATORY, not defensive noise: NOW() is
  // transaction-scoped, so under parallel load a statement that waits on the
  // row lock can reach ON CONFLICT with a NOW() EARLIER than the `updatedAt` its
  // predecessor just committed. Elapsed is then slightly negative, and FLOOR of
  // a small negative number is -1 — so instead of refilling nothing, the term
  // SUBTRACTED a token. A bucket holding 1 token with a future `updatedAt` was
  // wrongly blocked (spurious 429 under concurrent serverless traffic). Clamped
  // at zero the term is exactly 0: no refill, no subtraction, one token consumed.
  //
  // * 1000 converts EXTRACT(EPOCH …) seconds to milliseconds before the
  // division by the millisecond window.
  const refill = Prisma.sql`FLOOR(GREATEST(0, EXTRACT(EPOCH FROM (NOW() - "RateLimitBucket"."updatedAt"))) * 1000 * ${limit} / ${windowMs})::int`;
  const refilled = Prisma.sql`LEAST(${limit}::int, GREATEST(0, "RateLimitBucket"."tokens" + ${refill}))`;

  const rows = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "tokens", "updatedAt")
    VALUES (${key}, ${limit - 1}::int, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "tokens" = ${refilled} - 1,
      "updatedAt" = CASE
        WHEN ${refill} > 0 THEN NOW()
        ELSE "RateLimitBucket"."updatedAt"
      END
    WHERE ${refilled} >= 1
    RETURNING "tokens"::int AS "remainingTokens", "updatedAt" AS "updatedAt"
  `);

  if (rows.length > 0) {
    // Opportunistic cleanup AFTER the take succeeded: this is a write path, so
    // the ~1-in-N probability gate keeps the extra `DELETE` off the hot path for
    // almost every request while still bounding the table over time.
    await maybePruneStaleBuckets();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Blocked. The decision above is final; this read only supplies the retry
  // hint (the same math the in-memory limiter used).
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key }, select: { updatedAt: true } });
  const elapsedMs = bucket ? Date.now() - bucket.updatedAt.getTime() : 0;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsedMs) / 1000)),
  };
}

export async function takeToken(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await consumeToken(key, opts);
  } catch (error) {
    // Fail open — see the module header. Only the route prefix is logged: the
    // full key carries an IP and/or an email address.
    console.warn(`[zubeli] rate limiter unavailable, failing open for "${key.split(':')[0]}":`, error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Throws RateLimitError (→ RATE_LIMITED / 429) when the bucket is empty. */
export async function assertRateLimit(key: string, opts: RateLimitOptions): Promise<void> {
  const result = await takeToken(key, opts);
  if (!result.allowed) {
    throw new RateLimitError(`Too many requests — try again in ${result.retryAfterSeconds}s`, result.retryAfterSeconds);
  }
}

export async function withRateLimit<T>(key: string, opts: RateLimitOptions, fn: () => Promise<T>): Promise<T> {
  await assertRateLimit(key, opts);
  return fn();
}