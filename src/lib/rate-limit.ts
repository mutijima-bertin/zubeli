/**
 * In-memory token-bucket rate limiter (ADR 0002).
 * Single-instance only — fine for the MVP demo; swap for Redis/Upstash when
 * horizontally scaled (deployment-patterns). Buckets are keyed by opaque
 * strings built by callers: `register:${ip}`, `login:${ip}:${email}`,
 * `checkout:${ip}:${cartId}`.
 */
import { RateLimitError } from '@/lib/errors';

export type RateLimitOptions = {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

type Bucket = { tokens: number; last: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Defaults from ADR 0002 (env-tunable later; document when scaling). */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 }, // per IP + email
  register: { limit: 5, windowMs: 60 * 60 * 1000 }, // per IP
  checkout: { limit: 10, windowMs: 60 * 60 * 1000 }, // per IP + cart
} as const;

function pruneExpired(now: number): void {
  for (const [key, b] of buckets) {
    if (now - b.last > 60 * 60 * 1000) buckets.delete(key);
  }
}

export function takeToken(key: string, { limit, windowMs }: RateLimitOptions): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) pruneExpired(now);
    buckets.set(key, { tokens: limit - 1, last: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Refill proportional to elapsed time (token bucket).
  const refill = Math.floor(((now - bucket.last) / windowMs) * limit);
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.last = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - bucket.last)) / 1000)) };
}

/** Throws RateLimitError (→ RATE_LIMITED / 429) when the bucket is empty. */
export function assertRateLimit(key: string, opts: RateLimitOptions): void {
  const result = takeToken(key, opts);
  if (!result.allowed) {
    throw new RateLimitError(`Too many requests — try again in ${result.retryAfterSeconds}s`, result.retryAfterSeconds);
  }
}

export async function withRateLimit<T>(key: string, opts: RateLimitOptions, fn: () => Promise<T>): Promise<T> {
  assertRateLimit(key, opts);
  return fn();
}
