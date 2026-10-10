/**
 * Shared result-envelope assertions for integration tests.
 *
 * Why a shared helper: every integration file used its own private `expectOk`,
 * and two of those shapes were defective —
 *
 *   function expectOk(result) {
 *     expect(result.ok).toBe(true);   // <-- throws a bare "expected false to be
 *     if (!result.ok) throw ...       //     true" BEFORE the error is ever read
 *     return result.data;
 *   }
 *
 * The `expect(result.ok).toBe(true)` line fires first, so when a server action
 * returned `{ ok:false, error:{ code:'NOT_AUTHORIZED', ... } }` the test output
 * showed only a boolean mismatch and the returned `error.code` /
 * `error.message` — the actual cause — were discarded. Observed live in
 * tests/integration/admin-categories.test.ts (cross-worker session race,
 * 2026-10-05).
 *
 * This helper asserts WITH the diagnostic attached: a failing `expectOk` names
 * the action's error code and message in the assertion output.
 *
 * The `expectError` half is the complement: it fails with a clear message when
 * the action unexpectedly succeeded (optionally saying what data came back),
 * and otherwise hands back the full `{ code, message, details }` so callers can
 * assert on every field.
 */
import { expect } from "vitest";

/** Structural shape of the `ActionResult<T>` envelope (and of mocked variants). */
export type TestResult<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
};

/**
 * Assert the envelope is a success and return `data`.
 * On failure the assertion output carries `error.code` + `error.message`.
 */
export function expectOk<T>(result: TestResult<T>): T {
  if (!result.ok) {
    const code = result.error?.code ?? "(missing error.code)";
    const message = result.error?.message ?? "(missing error.message)";
    const detail = `expected ok result, but the action returned error ${code}: ${message}`;
    // Always throws (ok is false) — the message is what the reporter prints.
    expect(result.ok, detail).toBe(true);
    // Unreachable; keeps TS narrowing honest if `expect` ever stopped throwing.
    throw new Error(detail);
  }
  if (result.data === undefined) {
    const detail = "expected ok result to carry data, but data was undefined";
    expect(result.data, detail).toBeDefined();
    throw new Error(detail);
  }
  return result.data;
}

/**
 * Assert the envelope is a failure and return its `error` payload.
 * On failure (the action succeeded) the assertion output says so.
 */
export function expectError<T>(result: TestResult<T>): { code: string; message: string; details?: unknown } {
  if (result.ok) {
    const detail = "expected an error result, but the action returned ok";
    expect(result.ok, detail).toBe(false);
    throw new Error(detail);
  }
  if (!result.error) {
    const detail = "expected an error result to carry error.code/error.message, but error was missing";
    expect(result.error, detail).toBeDefined();
    throw new Error(detail);
  }
  return { code: result.error.code, message: result.error.message, details: result.error.details };
}
