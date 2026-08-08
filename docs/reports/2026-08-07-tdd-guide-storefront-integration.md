# 2026-08-07 — tdd-guide — storefront integration tests (Milestone 3 gate)

## What was added
Tests for the Phase C buying-flow actions, DB mocked at the prisma singleton
(`vi.mock("@/lib/db")` + `next/headers` cookie store) — real `lib/cart`,
`lib/orders`, payment providers, DTO mappers, zod schemas run; no live DB.

- `tests/integration/storefront/cart.test.ts` — 12 tests: getCartAction (cookie + empty DTO),
  addToCartAction (success DTO, stock cap, NOT_FOUND, out-of-stock VALIDATION, fieldErrors,
  qty 0/100), updateCartQtyAction (absolute qty + cap, qty 0, NOT_FOUND), removeCartItemAction.
- `tests/integration/storefront/checkout.test.ts` — 12 tests: getCheckoutCartAction, createOrderAction
  (COD_CASH happy w/ stock decrement + cart clear, BANK_TRANSFER w/o ref VALIDATION-before-write,
  with ref → instructions carry customer reference, COD_MOBILE_MONEY + MoMo number, OUT_OF_STOCK,
  empty cart, unpublished item, MOMO_GATEWAY), getCheckoutOrderAction (valid → order number as ref,
  NOT_FOUND, VALIDATION).
- `tests/integration/storefront/account.test.ts` — 13 tests: getMyOrdersAction (DTO map + cursor
  passthrough, take+1 pagination, 401 no session, invalid limit), getMyOrderAction (DTO + instructions,
  NOT_FOUND, IDOR, 401), updateProfileAction (update, clear phone, VALIDATION, 401).
- `tests/unit/storefront.test.ts` — +2 tests: price-desc/featured sort passthrough, getRelated
  dedupes featured picks already in category (small uncovered-branch fill).

## Verification
- `npx vitest run` → 15 files / 264/264 PASS (integration 61: storefront 37 + actions 24; unit 203)
- `npx tsc --noEmit` → exit 0 clean
- `npm run lint` → 0 problems (warn fixed: unused `options` in checkout cookie mock)
- Fixture-soak: account pagination date fixed via `Date.UTC(2026, 7, 1 + n, 9)` + full-numeric id
  parse (order-9 → day 10; no invalid-date INTERNAL).

## Next steps
- runner Checkpoint 3 (boot + curl each storefront route + add-to-cart smoke) → quality gate.
- Phase D e2e specs (tdd-guide hands off to e2e-runner; journeys reuse these DTO contracts).
- Registered-user cart path (session cart) only covered at lib/DTO level — defer to Phase D e2e
  journey 3 if a unit gap appears.