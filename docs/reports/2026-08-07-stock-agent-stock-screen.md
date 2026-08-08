# 2026-08-07 — stock-agent — admin stock screen

**What:** `/admin/stock` built — the exclusive stock-agent route (Milestone 5).

**Files (7, all under `src/app/admin/stock/`):**
- `page.tsx` — server shell: h1+description, metadata, 3 parallel action calls (KPI full list, table page, ledger page), KPI band, `<StockScreen>`.
- `_components/stockLevel.ts` — client-safe `stockLevel(qty,threshold)` + `stockLevelMeta` (OUT/LOW/OK StatusMeta).
- `_components/StockKpis.tsx` — 4 StatCards (Products / Out of stock / Low stock / Items in stock) computed from `listStockAdminAction({limit:100})` (no KPI endpoint on stock actions).
- `_components/StockScreen.tsx` — client shell; mounts a **local `ToastProvider`** (admin layout has none — dashboard-agent gap) and bumps `movementRefreshKey` after adjustments.
- `_components/StockTable.tsx` — client: FilterBar (debounced search + "Include deleted" checkbox), DataTable (product→`/admin/products/[id]/edit`, category, qty/threshold, StatusBadge, per-row Adjust), cursor load-more (20/page, shared request-id guard), Clear filters, error+Retry.
- `_components/AdjustStockDialog.tsx` — Dialog form: Action (IN/OUT), Reason (RESTOCK only for IN; OUT forces ADJUSTMENT), Quantity (1..10000), Note (≤500); live "stock after" + below-zero warning; `adjustStockAction` via useTransition → toast + row patch + ledger refresh; fieldErrors from `VALIDATION`.
- `_components/MovementsLedger.tsx` — "Recent movements" DataTable (10/page, newest first): Product→storefront link, Type badge, Reason badge, signed qty (+green/−red), `formatDateTime`, orderNumber text; refresh-first-page on stock change; load-more; error+Retry.

**Consumed actions:** `listStockAdminAction`, `adjustStockAction`, `listMovementsAction` (no new actions/types). **Verified:** `npx tsc --noEmit` clean on my files, `npx eslint src/app/admin/stock` → 0 problems (live tsc errors only in sales-agent `/admin/page.tsx` + inventory-agent `ProductForm.tsx` — parallel WIP, untouched).

**Schema discoveries (differ from brief):** `stockAdjustSchema` = `{productId, quantity: int 1..10000, reason:'RESTOCK'|'ADJUSTMENT', direction:'IN'|'OUT' (default IN), note? ≤500}` — there is **no signed-quantity rule**; the form sends explicit `direction`. `adminListProductsSchema` = `{cursor, limit≤100, search, categorySlug, includeDeleted}` — **no low-stock-only/restock-only/unpublished filters** exist (FilterBar uses search + includeDeleted only). `StockMovementDTO.orderNumber` only (no `orderId`) → ledger order values are plain text, unlinkable. Admin shell has **no ToastProvider** (mounted locally).

**Next:** runner Checkpoint 5 smoke; admin e2e journeys.