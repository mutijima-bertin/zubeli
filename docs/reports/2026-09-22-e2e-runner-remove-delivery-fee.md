# 2026-09-22 — e2e-runner — Delivery-fee removal reflected in e2e suite GREEN (29/29)

**What was done:** Updated the Playwright suite for the removal of the 2,000 RWF delivery fee (decision 2026-09-22). Cart/order totals are now subtotal-only everywhere; the app already computes `totalCents = subtotalCents` (src/lib/orders.ts, src/lib/db/orders.ts), so the specs now assert fee-free totals.

**Files touched (e2e/ only):**
- `e2e/data.ts` — deleted `DELIVERY_FEE_RWF` export + comment (clears the long-standing unused-export lint warning).
- `e2e/pages/CartPage.ts` — `expectSummary({ subtotal, total })`; dropped the delivery-line assertion.
- `e2e/specs/cart.spec.ts` — dropped import + `delivery` field; summary total 132,000 → **130,000 RWF** (2 × 65,000 = subtotal = total).
- `e2e/specs/checkout.spec.ts` — success total 132,000 → **130,000 RWF** (fee-inclusive total found via the `2,000` grep).
- `e2e/specs/account.spec.ts` — dropped import; success + detail totals 50,000 → **48,000 RWF** (1 × 48,000 wheelbarrow); comment "(48,000 + 2,000 delivery)" → subtotal = total.

**Two extra e2e fixes surfaced by the run (both e2e-owned test bugs, not app bugs):**
- `e2e/specs/admin-sales.spec.ts` — date-range regex `\w{3}` failed on en-GB "Sept" (4 letters): today is 2026-09-22, so the FilterBar renders "22 Sept 2026". Regex → `[A-Z][a-z]{2,3}` (all 12 en-GB months). Latent since e2e started; prior green runs were in 3-letter months.
- `e2e/pages/AdminSalesPage.ts` — `applyPeriod` fill→click race (React controlled inputs); observed submitting the previous period once under full-suite load. Now asserts `toHaveValue` after fill before clicking Apply.

**Evidence:** `npx playwright test` (E2E_BASE_URL=http://localhost:3001, dev server on :3001 pinned to test DB 5435 via TEST_DATABASE_URL — :3000 belongs to another project, untouched) → **29 passed (3.4m)**. `npx tsc --noEmit`: 0 errors in e2e/ (pre-existing `deliveryFeeCents` errors are all in tests/*, owned by tdd-guide — not touched). `npx eslint e2e`: 0 errors; only known warning left is the pre-existing unused `Locator` in CatalogPage.ts. Grep sweep of e2e/ for `DELIVERY_FEE|2,000|delivery`: only payment-method strings remain ("Pay on delivery — Cash/Mobile Money", MoMo instructions).

**Notes:** One non-green run mid-task was a rate-limiter trip from repeated owner logins across my runs (in-memory limiter in the dev server) — restarting the dev server reset it; the final run used the project's one-login-per-run `global-setup` bootstrap. No app bugs found — nothing handed to app agents.

**Next steps:** nothing pending; suite green. docs-writer may add this report to the index.