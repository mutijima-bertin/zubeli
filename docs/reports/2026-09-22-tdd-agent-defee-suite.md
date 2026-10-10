# 2026-09-22 — TDD Agent — No-Delivery-Fee De-Fee Wave (Test Suite)

## What was done
Re-synced the vitest suite with the already-landed "no delivery fee" app/schema change (Order
no longer has `deliveryFeeCents`; `totalCents == subtotalCents`; `CartDTO`/`OrderDTO` drop the
fee property). Fixed stale fee fixtures/assertions in the 4 red test files + 1 tsc-typed fixture.

## Root cause (empirically proven)
Fresh vitest run: **4 files RED / 16 tests** — `tests/unit/storefront.test.ts` (1),
`tests/integration/actions.test.ts` (11), `tests/integration/storefront/cart.test.ts` (2),
`tests/integration/storefront/checkout.test.ts` (2).
Prisma's validation error ("Unknown argument `customerId`") was misleading: a live probe on the
test DB (5435, rolled-back transactions) proved `db.order.create` accepts `customerId: null` fine;
passing **any** `deliveryFeeCents` key is what the client rejects (field removed from schema).

## Files touched (tests/ only — no app code)
- `tests/integration/actions.test.ts` — removed `deliveryFeeCents: 2000` from createOrderDirect
  (fixes 9 Prisma-validation failures); guest-cart total 2000→0; COD_CASH order total 32000→30000,
  amountCents 32000→30000, dropped `deliveryFeeCents` assertion.
- `tests/integration/storefront/cart.test.ts` — total 32000→30000; empty-cart total 2000→0.
- `tests/integration/storefront/checkout.test.ts` — empty-cart total 2000→0 (test renamed);
  COD_CASH totals 32000→30000 + dropped fee assertion; order fixture + orderDetail assertions
  32000→30000, amountCents 32000→30000 (3 places).
- `tests/unit/storefront.test.ts` — removed fee from siteConfig mock, dropped fee assertion →
  `not.toHaveProperty("deliveryFeeCents")`, test name cleaned.
- `tests/unit/use-cart.test.tsx` — removed stale `deliveryFeeCents` from typed CartDTO fixture
  (tsc error TS2353).

## Verification evidence
- `npx vitest run` → **19 files / 321 tests / 321 passed, 0 failed, 0 skipped** (8.4s)
- `npx tsc --noEmit` → **0 errors**
- Live DB probe (/tmp/probe_create.cjs, all in rolled-back txs): A(fee)→rejected, B(no fee)→OK,
  C(fee)→rejected, D(app shape no fee)→OK; test DB left clean.

## Next steps
- No app bugs found — nothing handed to owning agents. Deployment/CI will pick up the green suite
  on the next checkpoint; the 2026-08-09 uncommitted wave + this suite change still need the
  user-approved commit.