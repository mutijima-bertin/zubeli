# Orders screens (admin) — Milestone 5

**Agent:** orders-screen-agent — **Date:** 2026-08-07

## Done
- `/admin/orders` list: server page (h1 "Orders", metadata, URL-owned filters `?status/?method/?q`, NOT_FOUND-free inline error + retry) + client `OrdersList` (FilterBar: status/method selects + search form; DataTable: Order number stretched link, Customer name/phone/email, Placed `formatDateTime`, N items, Total `formatRWF`, StatusBadge order + payment badges; cursor load-more accumulating pages client-side; per-filter empty states + Clear filters).
- `/admin/orders/[id]` detail: server page → `getOrderAdminAction`; `NOT_FOUND → notFound()`, other errors inline Alert. h1 + status/method/payment StatusBadges; client `StatusActions` (buttons gated by current status per lifecycle, disabled+wrapper `title` tooltip, confirm Dialog → server action → `router.refresh()` + success/danger Alert; INVALID_TRANSITION surfaces as Alert, never crash); Items Table, Totals dl, Payment card (method/status/amount + `paymentInstructions` ol + prominent BANK_TRANSFER reference block when PENDING), Customer + Delivery snapshot cards, server OrderTimeline.
- Only own routes/files touched; consumed shell widgets via imports; no new actions/types.

## Files
`src/app/admin/orders/{page.tsx, _components/{OrdersList.tsx, orders-options.ts}}` and `src/app/admin/orders/[id]/{page.tsx, _components/{StatusActions.tsx, OrderTimeline.tsx}}` (6 files).

## Verified
- `npx tsc --noEmit`: 0 errors in my files (4 pre-existing in others' parallel WIP: `src/app/admin/page.tsx` [sales-agent], `src/app/admin/products/_components/ProductForm.tsx` [inventory-agent]).
- `npm run lint`: 0 errors (2 pre-existing e2e-runner warnings, not mine).

## Next
- runner Checkpoint 5 smoke (/admin/orders list + a detail status-change round-trip); admin e2e journeys writer hits these routes.