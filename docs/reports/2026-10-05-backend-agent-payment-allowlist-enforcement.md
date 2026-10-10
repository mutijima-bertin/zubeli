# Backend agent — payment allowlist enforcement + rate-limit pruning (2026-10-05)

**Task:** fix a confirmed HIGH payment bug (allowlist enforced after persistence) + two related MEDIUMs (demo-mode bypass, unpruned rate-limit buckets).
**Status:** DONE, all verification green. No commit (per publishing guardrail).

## Fixes
- **BUG 1 (HIGH):** `src/lib/orders.ts` `placeOrder` now resolves `getPaymentProvider(input.paymentMethod)` **before** `createOrder` — a disallowed method throws before any Order/Payment write, stock move, ledger append or cart clear. Added a server-only `serverCheckoutSchema = checkoutSchema.superRefine(...)` in `src/actions/checkout.ts` that rejects a non-`PAYMENT_METHODS` method with `details.fieldErrors.paymentMethod` before `placeOrder` is reached. Bank-transfer-reference guard kept.
- **BUG 2 (MEDIUM):** `src/lib/payments/index.ts` reordered — allowlist first, then `demoMode` (demo only swaps the provider, never the accepted methods); new exported `isPaymentMethodOffered()`.
- **BUG 3 (MEDIUM):** `src/lib/rate-limit.ts` added opportunistic, fail-soft prune after a successful take: ~1-in-1000 probability, one bounded `DELETE … WHERE ctid IN (SELECT ctid … WHERE updatedAt < cutoff LIMIT 500)`. **Bound = `RATE_LIMIT_PRUNE_BATCH` (500 rows/call)**; TTL = `RATE_LIMIT_MAX_WINDOW_MS` (**60 min**, the longest configured window). A bucket younger than 60 min can still hold live tokens, so it is never deleted; older buckets are fully refilled for every route, so deleting them equals expiry. No-op under concurrent prunes; `maybePruneStaleBuckets` swallows all errors so a DB hiccup cannot fail the request.

## Tests (written first, RED→GREEN)
- New `tests/integration/storefront/payment-allowlist.test.ts` (4 tests): key regression (BANK_TRANSFER with `PAYMENT_METHODS=COD_CASH` → VALIDATION, **order count 0, stock 10, no ledger, no cart clear, `$transaction` not called**), demo-mode bypass proof, COD_CASH allowed, all 3 methods with env unset.
- `tests/integration/rate-limit.test.ts` (+5): stale vs live TTL, bounded batch, fail-open on prune error, probability gate.

## Evidence
- **Pre-fix RED (key test):** `AssertionError: expected 1 to be +0` (order created before rejection); demo test: `expected an error result, but the action returned ok`.
- **Post-fix:** `npm test` ×2 → **22 files / 365 tests passed** (was 21/356). `npx tsc --noEmit` → 0. `npm run lint` → 0.
- **DB:** TEST 5435 `orders=0 carts=0 cartItems=0 leftoverTestBuckets=0`; DEV 5434 `orders=17 products=43 categories=10` (matches documented baseline — untouched).

## Next
- Quality gate re-run (tsc/lint/vitest/e2e/build) by `runner`. No contract DTO changes. `isPaymentMethodOffered` is new server-side API; no frontend change needed. e2e unaffected (payment method still server-authorized).
