/**
 * In-memory token-bucket rate limiter (src/lib/rate-limit.ts).
 * Behaviors: allows N within a window, blocks N+1 with retryAfterSeconds,
 * refills proportionally over time, windows are per-key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertRateLimit, RATE_LIMITS, takeToken, withRateLimit } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";

const KEY = "test-bucket";
const FAST_WINDOW = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("takeToken — token bucket", () => {
  it("allows exactly N requests and blocks the N+1th", () => {
    for (let i = 0; i < 3; i++) {
      expect(takeToken(KEY, FAST_WINDOW)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    }
    const blocked = takeToken(KEY, FAST_WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("different keys have independent buckets", () => {
    takeToken("bucket-a", FAST_WINDOW);
    takeToken("bucket-a", FAST_WINDOW);
    takeToken("bucket-a", FAST_WINDOW);
    // bucket-b still full
    expect(takeToken("bucket-b", FAST_WINDOW).allowed).toBe(true);
  });

  it("refills after the window elapses", () => {
    takeToken("window-reset", { limit: 1, windowMs: 1000 });
    expect(takeToken("window-reset", { limit: 1, windowMs: 1000 }).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(takeToken("window-reset", { limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });

  it("refills proportionally to elapsed time within the window", () => {
    // limit 10 over 10s; burn all 10, wait 5s → 5 tokens back
    const opts = { limit: 10, windowMs: 10_000 };
    const key = "partial-refill";
    for (let i = 0; i < 10; i++) takeToken(key, opts);
    expect(takeToken(key, opts).allowed).toBe(false);

    vi.advanceTimersByTime(5000);
    for (let i = 0; i < 5; i++) {
      expect(takeToken(key, opts).allowed).toBe(true);
    }
    expect(takeToken(key, opts).allowed).toBe(false);
  });

  it("never refills above the limit", () => {
    const opts = { limit: 5, windowMs: 1000 };
    const key = "cap-refill";
    takeToken(key, opts);
    vi.advanceTimersByTime(60_000); // 60 windows worth — still capped at 5
    for (let i = 0; i < 5; i++) {
      expect(takeToken(key, opts).allowed).toBe(true);
    }
    expect(takeToken(key, opts).allowed).toBe(false);
  });
});

describe("assertRateLimit", () => {
  it("passes while tokens remain", () => {
    expect(() => assertRateLimit("assert-ok", { limit: 2, windowMs: 60_000 })).not.toThrow();
  });

  it("throws RateLimitError (RATE_LIMITED / 429) when exhausted, with retryAfterSeconds", () => {
    const key = "assert-block";
    assertRateLimit(key, { limit: 1, windowMs: 60_000 });
    try {
      assertRateLimit(key, { limit: 1, windowMs: 60_000 });
      expect.unreachable("expected RateLimitError");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      if (error instanceof RateLimitError) {
        expect(error.code).toBe("RATE_LIMITED");
        expect(error.httpStatus).toBe(429);
        expect(error.details).toEqual({ retryAfterSeconds: expect.any(Number) });
      }
    }
  });
});

describe("withRateLimit", () => {
  it("runs the function when allowed and returns its result", async () => {
    const fn = vi.fn(async () => 42);
    await expect(withRateLimit("with-ok", { limit: 1, windowMs: 60_000 }, fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not run the function when blocked", async () => {
    const key = "with-block";
    await withRateLimit(key, { limit: 1, windowMs: 60_000 }, async () => "first");
    const fn = vi.fn(async () => "second");
    await expect(withRateLimit(key, { limit: 1, windowMs: 60_000 }, fn)).rejects.toBeInstanceOf(RateLimitError);
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
