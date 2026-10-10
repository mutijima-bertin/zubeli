# orders-screen-agent — remove delivery fee from admin order detail

Date: 2026-09-22

## What was done
- Removed the "Delivery fee" definition row (dt + Price) from the Totals card on `/admin/orders/[id]`. Totals now show Subtotal → Total only (`total == subtotal` per new contract).
- Grep audit of owned route `src/app/admin/orders/` for `deliveryFeeCents` / `delivery fee` (case-insensitive): 0 occurrences remain.

## Files touched
- `src/app/admin/orders/[id]/page.tsx` (removed 6-line delivery-fee row)

## Verification evidence
- `npx tsc --noEmit` → 0 errors in `src/**` (all 10 remaining errors are in `tests/**` — delivery-fee removal fallout, owned by `tdd-guide`).
- `npm run lint` → 0 errors, 2 pre-existing warnings in `e2e/` (owned by `e2e-runner`); no findings in owned files.

## API types/endpoints consumed
- `OrderDTO` (`@/types/api`) via `getOrderAdminAction` (`@/actions/admin/orders`) — field `deliveryFeeCents` no longer referenced.

## Missing / notes for orchestrator
- `tests/` still references `deliveryFeeCents` across 6 files (unit + integration) → needs `tdd-guide` follow-up.
- `e2e/specs/account.spec.ts` imports unused `DELIVERY_FEE_RWF` → `e2e-runner` cleanup.
