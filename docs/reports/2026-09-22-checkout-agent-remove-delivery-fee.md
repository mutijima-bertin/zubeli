# Checkout: remove delivery-fee lines — 2026-09-22

**Agent:** checkout-agent · **Scope:** `/checkout` + `/checkout/success` only.

## What was done
- `src/app/(store)/checkout/_components/OrderSummaryPanel.tsx`: removed the "Delivery" row (`cart.deliveryFeeCents`) + updated file doc comment. Subtotal + Total rows kept.
- `src/app/(store)/checkout/_components/SuccessScreen.tsx`: removed the "Delivery fee" definition row (`order.deliveryFeeCents`). Subtotal + Total rows kept.
- Full-route grep for `delivery fee|deliveryFee|transport|2,000` (case-insensitive) under `src/app/(store)/checkout/` → 0 matches. Pay-on-delivery payment copy (PaymentMethodPicker, page meta, PlaceOrderButton) intentionally kept — payment method ≠ transport fee.

## Verification
- `npx tsc --noEmit` → 0 errors in `src/**`; remaining errors all in `tests/*` (deliveryFeeCents still in test fixtures — owned by test/backend agents).
- `npm run lint` → 0 errors, 2 pre-existing warnings (both in `e2e/`, known baseline).

## Files touched (2)
- `src/app/(store)/checkout/_components/OrderSummaryPanel.tsx`
- `src/app/(store)/checkout/_components/SuccessScreen.tsx`

## Next steps
- tests/ fixtures still reference `deliveryFeeCents` (tsc) + unused `DELIVERY_FEE_RWF` in `e2e/specs/account.spec.ts` (lint warning) → route to tdd-guide/e2e-runner.
