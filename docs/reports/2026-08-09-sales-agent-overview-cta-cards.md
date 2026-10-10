# 2026-08-09 — sales-agent — overview CTA cards

**Task:** make the /admin overview KPI cards functional whole-card CTA buttons (user requirement). Consumed dashboard-agent's new `StatCard href?: string` contract; replaced the temporary `KpiLink` wrapper + `hover:border-brand-600` hack.

## Card → destination mapping (actual cards on the page)

| Card | Value source | Destination | Why |
|---|---|---|---|
| Total revenue | `overview.data.totalRevenueCents` | `/admin/sales` | Revenue analytics home |
| Orders | `overview.data.orderCount` | `/admin/orders` | Orders list |
| Avg order value | `overview.data.avgOrderValueCents` | `/admin/sales` | Sales report hosts the same KPI |
| Low stock | `overview.data.lowStockCount` | `/admin/stock` | Stock levels (was already KpiLink-wrapped) |
| Pending payments | `overview.data.pendingPaymentCount` | `/admin/orders` | Orders awaiting manual confirmation (was already KpiLink-wrapped) |

No customers/top-products KPI cards exist on the page — nothing invented; every existing card is wired.

## Files changed

- `src/app/admin/page.tsx` — removed `KpiLink` component + `Link`/`ReactNode` imports; added `href` to all 5 StatCards; low-stock/pending-payments keep `className="h-full"` only (hack classes dropped). Data layer untouched (`getOverviewAction`/`getRevenueByMonthAction`/`getTopProductsAction`/`listOrdersAdminAction`); card order, values, chart, tables byte-identical.

## Verification evidence

- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors, 2 warnings (both known e2e ones: CatalogPage Locator, account.spec DELIVERY_FEE_RWF)
- Route smoke skipped per brief (needs OWNER session; runner owns)

## Next steps

- Runner route smoke of `/admin` hover/link behavior; tdd-guide may add a StatCard-link render test.