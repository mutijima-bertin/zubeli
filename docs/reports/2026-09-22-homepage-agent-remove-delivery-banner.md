# Report — homepage-agent: remove delivery-fee banner

*Date: 2026-09-22*

## What was done
- Deleted `src/app/(store)/_components/DeliveryBanner.tsx` entirely (the 2,000 RWF flat-fee band).
- `src/app/(store)/page.tsx` — removed the `DeliveryBanner` import and the `<DeliveryBanner deliveryFeeCents={data.deliveryFeeCents} />` line. No other page changes; the banner had no dedicated wrapper (it was a direct child of the page fragment), so the section stack just closes the gap.
- `src/app/(store)/_components/TrustSignals.tsx` — doc-comment cleanup only: dropped two lines referencing the deleted DeliveryBanner / the old fee card.

## Page section order now
Hero → FeaturedProducts → CategoriesShowcase → TrustSignals → ClosingCta (fragment, no wrappers changed).

## Files touched
- DELETED: `src/app/(store)/_components/DeliveryBanner.tsx`
- EDITED: `src/app/(store)/page.tsx`
- EDITED: `src/app/(store)/_components/TrustSignals.tsx` (comment only)

## Verification
- `npx tsc --noEmit` → exit 2, but ZERO errors in homepage-agent files. All 13 remaining errors are `deliveryFeeCents` references in other owners' files: checkout `OrderSummaryPanel.tsx`/`SuccessScreen.tsx`, `admin/orders/[id]/page.tsx`, `account/orders/[id]/page.tsx` (via OrderDTO/CartDTO), and `tests/*` — expected; their owners handle them.
- `npm run lint` → exit 0 (0 errors; 2 pre-existing known e2e warnings: `CatalogPage.ts` unused Locator, `account.spec.ts` unused `DELIVERY_FEE_RWF`).
- Grep: zero `DeliveryBanner` references left anywhere in the repo's `src/`.

## Next steps
- Screen owners (cart/checkout/account/admin) remove their remaining fee lines; tdd-guide updates tests.
