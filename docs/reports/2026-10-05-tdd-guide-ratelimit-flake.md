# tdd-guide — rate-limit leakage fix + `visiblePaymentOptions` coverage (2026-10-05)

**Flake (before).** `register:203.0.113.7` leaked across runs — the limiter is
Postgres-backed and `clientIp()` uses the mocked constant `x-forwarded-for`, so the
5/hour register bucket (3 `registerAction` calls/run) drained. Evidence: run 1
`1 failed | 18 passed (19)`, `Tests 1 failed | 323 passed` with
`expected 'RATE_LIMITED' to be 'CONFLICT'`; the next drain produced
`3 failed | 321 passed`, and the worst case `19 failed | 305 passed` (a failed
`beforeAll` left no fixtures). Also blocked: the test DB was missing migration
`20261005083355_category_is_active` → `actions.test.ts` could not start. Applied to
**5435 only**; dev DB 5434 untouched.

**Fix (`tests/integration/actions.test.ts` only).** `clearRateLimitBuckets()` — raw
scoped `DELETE FROM "RateLimitBucket" WHERE "key" LIKE 'register:203.0.113.7' | 'login:203.0.113.7:%' | 'checkout:203.0.113.7:%'`,
called in `beforeAll` **and** `afterAll`, plus `TEST_IP` hoisted out of the headers
mock. Deliberately NOT `TRUNCATE "RateLimitBucket"`: test files run in parallel
workers against one DB and `tests/integration/rate-limit.test.ts` owns
`rate-limit-test:<pid>:*` rows — a table-wide TRUNCATE would delete them mid-test.
No other suite leaks: `tests/unit/notifications-wiring.test.ts` mocks
`@/lib/rate-limit`; `storefront/{cart,checkout,account}.test.ts` mock `@/lib/db` and
their key parts (`cartId`, email) are per-run unique.

**After.** `npm test` ×3 consecutive: each `Test Files 20 passed (20)` /
`Tests 338 passed (338)`, exit 0, 0 `RATE_LIMITED` (plus 2 extra runs green = 5).

**New `tests/unit/payment-method-picker.test.ts`** (13 cases): all three methods in
catalogue order cash-first; `['COD_CASH']` / `['BANK_TRANSFER']` alone; `[]`/`null`/
`undefined` → cash; garbage (`MOMO_GATEWAY`, `CARD`, junk, `42`, `null`) never
throws and yields only renderable options; unknown entries dropped, renderable kept;
duplicates collapsed; catalogue order preserved under a shuffled allowlist; catalogue
not mutated + option identity; `FALLBACK_PAYMENT_METHOD === 'COD_CASH'` (no
`requiresReference`) and always returned for unusable allowlists. Imports cleanly in
the default **node** env — no jsdom or source workaround needed.

**Task 4.** No test asserted the old sync limiter API or un-timezoned output.
Hardened `tests/unit/format.test.ts` with exact business-zone strings
(`23:30Z → "6 Aug 2026"`, `"5 Aug 2026, 12:30"`) that fail without the
`Africa/Kigali` pin — verified under `TZ=UTC`, `America/New_York`, `Asia/Tokyo`.
Also added the missing `isActive` fixture field in `dto`/`storefront`/`cart`/
`checkout` tests (pre-existing `tsc` errors from today's `Category.isActive`
migration).

**Verify.** `npm test` 20 files / 338 tests ×3 green · `npx tsc --noEmit` 0 errors ·
`npm run lint` 0 errors (1 pre-existing e2e warning) · dev 5434 after all runs:
buckets 0, `test-` users 0, `test-` products 0 (5435 buckets 0 after cleanup).