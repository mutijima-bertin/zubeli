/**
 * Postgres-backed token-bucket rate limiter (src/lib/rate-limit.ts) against the
 * REAL test database (5435) — never the dev DB (5434). It lives under
 * tests/integration because the bucket is a database row now: fake timers and
 * an in-process Map cannot exercise an `INSERT ... ON CONFLICT` statement.
 *
 * Behaviors: allows N within a window, blocks N+1 with retryAfterSeconds,
 * refills proportionally over time, never refills above the limit, buckets are
 * per key, tokens never go negative, concurrent takes cannot both consume the
 * last token, a future-dated `updatedAt` (the racing-statement state) consumes
 * exactly one token, and a database failure fails OPEN.
 *
 * Elapsed time is simulated by ageing the stored `updatedAt` instead of by
 * faking the clock: the refill math runs inside Postgres (`NOW()` server-side).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  assertRateLimit,
  pruneStaleBuckets,
  RATE_LIMIT_MAX_WINDOW_MS,
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMITS,
  takeToken,
  withRateLimit,
} from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";
import { prisma as appPrisma } from "@/lib/db";

const db = new PrismaClient();
const PREFIX = `rate-limit-test:${process.pid}:`;
const FAST_WINDOW = { limit: 3, windowMs: 60_000 };

function key(name: string): string {
  return `${PREFIX}${name}`;
}

async function age(name: string, ms: number): Promise<void> {
  await db.$executeRaw`
    UPDATE "RateLimitBucket" SET "updatedAt" = NOW() - ${`${ms} milliseconds`}::interval
    WHERE "key" = ${key(name)}
  `;
}

/**
 * The inverse of `age`: push `updatedAt` into the FUTURE, i.e. reproduce the
 * state a racing statement observes. `NOW()` is transaction-scoped, so the
 * transaction that waits on the row lock can reach `ON CONFLICT` with a `NOW()`
 * EARLIER than the `updatedAt` its predecessor wrote — elapsed goes slightly
 * negative and the refill term must clamp to 0, never subtract a token.
 */
async function pushForward(name: string, ms: number): Promise<void> {
  await db.$executeRaw`
    UPDATE "RateLimitBucket" SET "updatedAt" = NOW() + ${`${ms} milliseconds`}::interval
    WHERE "key" = ${key(name)}
  `;
}

beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: PREFIX } } });
});

afterAll(async () => {
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("takeToken — token bucket in Postgres", () => {
  it("allows exactly N requests and blocks the N+1th", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(takeToken(key("allow-n"), FAST_WINDOW)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    }
    const blocked = await takeToken(key("allow-n"), FAST_WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("never stores a negative balance (blocked takes do not consume)", async () => {
    await takeToken(key("floor-zero"), { limit: 1, windowMs: 60_000 });
    await takeToken(key("floor-zero"), { limit: 1, windowMs: 60_000 });
    await takeToken(key("floor-zero"), { limit: 1, windowMs: 60_000 });
    const stored = await db.rateLimitBucket.findUnique({ where: { key: key("floor-zero") } });
    expect(stored?.tokens).toBe(0);
  });

  it("different keys have independent buckets", async () => {
    for (let i = 0; i < 3; i++) await takeToken(key("independent-a"), FAST_WINDOW);
    expect((await takeToken(key("independent-a"), FAST_WINDOW)).allowed).toBe(false);
    expect((await takeToken(key("independent-b"), FAST_WINDOW)).allowed).toBe(true);
  });

  it("refills proportionally to elapsed time within the window", async () => {
    // limit 10 over 10s; burn all 10, wait 5s → 5 tokens back
    const opts = { limit: 10, windowMs: 10_000 };
    const name = "partial-refill";
    for (let i = 0; i < 10; i++) await takeToken(key(name), opts);
    expect((await takeToken(key(name), opts)).allowed).toBe(false);

    await age(name, 5_000);
    for (let i = 0; i < 5; i++) {
      expect((await takeToken(key(name), opts)).allowed).toBe(true);
    }
    expect((await takeToken(key(name), opts)).allowed).toBe(false);
  });

  it("refills after the whole window elapses", async () => {
    const opts = { limit: 1, windowMs: 1000 };
    await takeToken(key("window-reset"), opts);
    expect((await takeToken(key("window-reset"), opts)).allowed).toBe(false);
    await age("window-reset", 1001);
    expect((await takeToken(key("window-reset"), opts)).allowed).toBe(true);
  });

  it("never refills above the limit", async () => {
    const opts = { limit: 5, windowMs: 1000 };
    const name = "cap-refill";
    await takeToken(key(name), opts);
    await age(name, 60_000); // 60 windows worth — still capped at 5
    for (let i = 0; i < 5; i++) {
      expect((await takeToken(key(name), opts)).allowed).toBe(true);
    }
    expect((await takeToken(key(name), opts)).allowed).toBe(false);
  });

  it("consumes the last token exactly once under concurrency (single atomic statement)", async () => {
    // 8 "serverless instances" racing for 3 tokens.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => takeToken(key("race"), { limit: 3, windowMs: 60_000 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect((await db.rateLimitBucket.findUnique({ where: { key: key("race") } }))?.tokens).toBe(0);
  });

  it("consumes exactly one token when updatedAt is in the FUTURE (negative elapsed must not subtract)", async () => {
    // Regression for the concurrency bug below. `NOW()` is transaction-scoped:
    // under parallel load a statement that waits on the row lock can reach
    // `ON CONFLICT` with a `NOW()` EARLIER than the `updatedAt` the winner just
    // committed. Elapsed then goes negative, and unclamped
    // FLOOR(-0.1) = -1 turned the REFILL term into a SUBTRACTION, so the take
    // was blocked (or the balance dropped a token it should have kept).
    const opts = { limit: 3, windowMs: 60_000 };
    const name = "negative-elapsed";
    expect((await takeToken(key(name), opts)).allowed).toBe(true);
    expect((await takeToken(key(name), opts)).allowed).toBe(true);
    expect((await db.rateLimitBucket.findUnique({ where: { key: key(name) } }))?.tokens).toBe(1);

    await pushForward(name, 2_000); // stored updatedAt is now 2s ahead of the reader

    // One token left and no whole token has accrued → allowed, and it consumes
    // exactly one token. Unclamped: LEAST(3, GREATEST(0, 1 + -1)) = 0 → the
    // WHERE gate fails and the take is wrongly blocked.
    expect(await takeToken(key(name), opts)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect((await db.rateLimitBucket.findUnique({ where: { key: key(name) } }))?.tokens).toBe(0);
  });

  it("fails OPEN when the database is unavailable (never blocks a paying customer)", async () => {
    const spy = vi.spyOn(appPrisma, "$queryRaw").mockRejectedValueOnce(new Error("db down") as never);
    try {
      await expect(takeToken(key("fail-open"), { limit: 1, windowMs: 60_000 })).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
      // assertRateLimit must not throw either — no 500 from a limiter outage.
      await expect(assertRateLimit(key("fail-open"), { limit: 1, windowMs: 60_000 })).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("assertRateLimit", () => {
  it("passes while tokens remain", async () => {
    await expect(assertRateLimit(key("assert-ok"), { limit: 2, windowMs: 60_000 })).resolves.toBeUndefined();
  });

  it("throws RateLimitError (RATE_LIMITED / 429) when exhausted, with retryAfterSeconds", async () => {
    const name = "assert-block";
    await assertRateLimit(key(name), { limit: 1, windowMs: 60_000 });
    const error = await assertRateLimit(key(name), { limit: 1, windowMs: 60_000 }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RateLimitError);
    if (error instanceof RateLimitError) {
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.httpStatus).toBe(429);
      expect(error.details).toEqual({ retryAfterSeconds: expect.any(Number) });
    }
  });
});

describe("withRateLimit", () => {
  it("runs the function when allowed and returns its result", async () => {
    const fn = vi.fn(async () => 42);
    await expect(withRateLimit(key("with-ok"), { limit: 1, windowMs: 60_000 }, fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not run the function when blocked", async () => {
    const name = "with-block";
    await withRateLimit(key(name), { limit: 1, windowMs: 60_000 }, async () => "first");
    const fn = vi.fn(async () => "second");
    await expect(withRateLimit(key(name), { limit: 1, windowMs: 60_000 }, fn)).rejects.toBeInstanceOf(RateLimitError);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("RATE_LIMITS defaults (ADR 0002)", () => {
  it("login: 10 per 15 min per IP+email", () => {
    expect(RATE_LIMITS.login).toEqual({ limit: 10, windowMs: 15 * 60 * 1000 });
  });
  it("register: 5 per hour per IP", () => {
    expect(RATE_LIMITS.register).toEqual({ limit: 5, windowMs: 60 * 60 * 1000 });
  });
  it("checkout: 10 per hour per IP+cart", () => {
    expect(RATE_LIMITS.checkout).toEqual({ limit: 10, windowMs: 60 * 60 * 1000 });
  });
});

describe("stale-bucket pruning (bounded cleanup)", () => {
  it("TTL is the longest configured window", () => {
    expect(RATE_LIMIT_MAX_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it("prunes a bucket older than the longest window and keeps one inside it", async () => {
    await db.rateLimitBucket.create({ data: { key: key("prune-stale"), tokens: 0 } });
    await db.rateLimitBucket.create({ data: { key: key("prune-live"), tokens: 0 } });
    // stale: one minute past the TTL; live: one minute inside it.
    await age("prune-stale", RATE_LIMIT_MAX_WINDOW_MS + 60_000);
    await age("prune-live", RATE_LIMIT_MAX_WINDOW_MS - 60_000);

    await pruneStaleBuckets();

    expect(await db.rateLimitBucket.findUnique({ where: { key: key("prune-stale") } })).toBeNull();
    // A bucket still inside its active window is NEVER deleted (safe TTL bound).
    expect(await db.rateLimitBucket.findUnique({ where: { key: key("prune-live") } })).not.toBeNull();
  });

  it("deletes at most RATE_LIMIT_PRUNE_BATCH rows per call (bounded batch)", async () => {
    const total = RATE_LIMIT_PRUNE_BATCH + 5;
    await db.rateLimitBucket.createMany({
      data: Array.from({ length: total }, (_, i) => ({ key: key(`prune-batch-${i}`), tokens: 0 })),
    });
    await db.$executeRaw`
      UPDATE "RateLimitBucket"
      SET "updatedAt" = NOW() - ${`${RATE_LIMIT_MAX_WINDOW_MS + 120_000} milliseconds`}::interval
      WHERE "key" LIKE ${`${PREFIX}prune-batch-%`}
    `;

    // A single call never deletes more than the batch bound (and never throws
    // if another serverless invocation pruned some of the same rows first).
    const deleted = await pruneStaleBuckets();
    expect(deleted).toBeLessThanOrEqual(RATE_LIMIT_PRUNE_BATCH);
  });

  it("a failing prune never fails the take — fail-open stays fail-open", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // force the probability gate
    const rawSpy = vi.spyOn(appPrisma, "$executeRaw").mockRejectedValueOnce(new Error("db down") as never);
    try {
      await expect(takeToken(key("prune-fail"), { limit: 1, windowMs: 60_000 })).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    } finally {
      randomSpy.mockRestore();
      rawSpy.mockRestore();
    }
  });

  it("does not prune on every take (probability gate keeps it off the hot path)", async () => {
    const rawSpy = vi.spyOn(appPrisma, "$executeRaw");
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5); // > 1/1000
    try {
      await takeToken(key("prune-gate"), { limit: 1, windowMs: 60_000 });
      expect(rawSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
      rawSpy.mockRestore();
    }
  });
});