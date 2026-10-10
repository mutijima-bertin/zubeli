# 2026-09-22 — backend-agent: remove flat delivery fee

**Decision:** fee completely removed (2026-09-22, user). Cart/order totals = subtotal only. Transport handled off-app; zero fee mentions in backend. DB column drop is database-agent's migration `20260922131646_remove_delivery_fee` (already on disk).

## Files changed (owned scope only)
- `src/lib/site.ts` — removed `deliveryFeeCents` from `SiteConfig`, deleted `parseDeliveryFeeCents()`, removed from `siteConfig`, fixed module doc comment (fee → bank details).
- `src/lib/cart.ts` — `toCartDTO(full, siteConfig.deliveryFeeCents)` → `toCartDTO(full)`; dropped now-unused `siteConfig` import.
- `src/lib/orders.ts` — removed `deliveryFeeCents` from `CheckoutContext` and `buildCheckoutContext`; `totalCents: subtotalCents`.
- `src/lib/db/orders.ts` — removed `DELIVERY_FEE_CENTS` const + comment, `deliveryFeeCents` from the createOrder tx; `totalCents = subtotalCents`; Payment `amountCents` unchanged code path (uses `totalCents` → now subtotal).
- `src/lib/dto.ts` — `toCartDTO(cart)` single-arg, no fee in return, `totalCents: subtotalCents`; `toOrderDTO` no longer maps `deliveryFeeCents`.
- `src/lib/storefront.ts` — `HomepageData` no longer has `deliveryFeeCents`; removed `siteConfig` import (was only for the fee).
- `src/types/api.ts` — `CartDTO` and `OrderDTO` field removals (see contract below).
- `.env.example` — removed `DELIVERY_FEE_CENTS=2000` + its comment.

## Contract changes (before → after)
- `CartDTO`: `{id, items, subtotalCents, deliveryFeeCents, totalCents, currency}` → `{id, items, subtotalCents, totalCents, currency}` (`totalCents` derived: subtotal).
- `OrderDTO`: `deliveryFeeCents` field removed entirely; `totalCents` unchanged (equals subtotal at checkout).
- `CheckoutContext` (internal): `deliveryFeeCents` removed; `totalCents = subtotalCents`.
- `HomepageData`: `deliveryFeeCents` removed.
- `toCartDTO` signature: 2 args → 1 arg.

## Verification
- `npx tsc --noEmit` — 14 errors, ALL in `tests/*` and `src/app/*` referencing the removed field/arg (list below). Zero errors in owned files (`src/lib/*`, `src/types/*`, `src/actions/*`).
- `npm run lint` — 0 errors, 2 warnings, both pre-existing in `e2e/` (CatalogPage `Locator`, account.spec `DELIVERY_FEE_RWF`) — not mine.
- Sweep: zero `deliveryFeeCents`/`DELIVERY_FEE`/`delivery-fee` mentions left in `src/lib`, `src/types`, `src/actions`, `src/app/api`, `.env.example` (kept: "pay-on-delivery" = payment method name; DB migration/seed/ADRs are database-agent/docs history).

## Expected breakage (owners to follow)
- Screens: `src/app/(store)/page.tsx` (HomepageData.deliveryFeeCents), `cart/_components/OrderSummary.tsx`, `checkout/_components/{OrderSummaryPanel,SuccessScreen}.tsx`, `account/orders/[id]/page.tsx`, `admin/orders/[id]/page.tsx`, `DeliveryBanner.tsx` (component itself still fee-copy — screen/frontend agents).
- Tests: `actions.test.ts` (2), `storefront/cart.test.ts`, `storefront/checkout.test.ts`, `unit/dto.test.ts` (4), `unit/storefront.test.ts`, `unit/use-cart.test.tsx`, `unit/notifications-wiring.test.ts`, `unit/orders-admin.test.ts`, `integration/account.test.ts` — all reference `deliveryFeeCents`/DELIVERY_FEE; `tests/setup.ts` still pins the env var.
- e2e: `data.ts` `DELIVERY_FEE_RWF`, `specs/cart.spec.ts`, `specs/account.spec.ts` — delivery-row assertions.

## Next
`tdd-guide` + `e2e-runner` update test/e2e to subtotal-only totals (expect `totalCents == subtotalCents`); `frontend-agent`/screen owners drop the fee line from cart/checkout/order UI and the DeliveryBanner; `docs-writer` optionally amends ADR 0001/0003/0004 (`deliveryFeeCents` references remain as history docs).