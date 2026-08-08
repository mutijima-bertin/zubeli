# 2026-08-07 — customers-screen-agent — admin customer screens

**Scope:** `/admin/customers` + `/admin/customers/[id]` (Milestone 5). Shell/widgets/actions/lib/prisma untouched.

**Files added (7, all mine):**
- `src/app/admin/customers/page.tsx` — server shell: `await searchParams` → `?q=` → `listCustomersAdminAction({search, limit:25})`; error → Alert+Try again (NOT_AUTHORIZED→`redirect("/")`); empty states (search vs none, Clear search / View orders); renders `CustomersTable` keyed by `q` so search changes remount cleanly.
- `src/app/admin/customers/_components/CustomersTable.tsx` — client: cursor load-more via `listCustomersAdminAction({search, cursor, limit})` (search preserved); live StatCards (Customers / Paying customers / Revenue paid — aggregate the **loaded rows**; MVP page-1 = full list) + DataTable: name (stretched link, `Guest` Badge when id null), phone, email, orders, total spent `formatRWF`, last order `formatDate`; `rowLink` only when `id !== null` (guests never link — no artificial ids).
- `src/app/admin/customers/_components/CustomerSearch.tsx` — client FilterBar: sr-only Label + Input + submit Button (`role="search"` form, router.push `?q=`, useTransition aria-busy), "Clear search" ghost when active.
- `src/app/admin/customers/loading.tsx` — skeleton cards + table (also covers `[id]`).
- `src/app/admin/customers/[id]/page.tsx` — server: `getCustomerAdminAction({customerId})`; NOT_FOUND/VALIDATION → `notFound()`, NOT_AUTHORIZED → redirect; h1 name + back link, 3 StatCards (Orders / Total spent `formatRWF` / Last order `formatDate`), Contact details Card (name/email/phone), Purchase history section.
- `src/app/admin/customers/[id]/_components/PurchaseHistoryTable.tsx` — server DataTable: number (row link → `/admin/orders/{id}`), date, items summary (`2 items — Angle Grinder +1 more`), total `Price`, status `StatusBadge orderStatusMeta`; EmptyState when 0 orders.
- `src/app/admin/customers/[id]/not-found.tsx` — EmptyState + Back to customers.

**Consumed ops:** `listCustomersAdminAction({search?, cursor?, limit?}) → ActionResult<Page<CustomerDTO>>`; `getCustomerAction` is actually **`getCustomerAdminAction({customerId})`** returning `ActionResult<{ customer: CustomerDTO; orders: OrderListItemDTO[] }>`.

**Detail return shape (exact):** `{ customer: { id, name, phone, email|null, ordersCount, totalSpentCents (PAID+FULFILLED only), lastOrderAt|null }, orders: OrderListItemDTO[] }` — per order row: `id, number, status, method, items[] {productName, quantity, unitPriceCents, lineTotalCents}, totalCents, currency, createdAt, paymentStatus, paymentConfirmedAt, customerName, customerPhone, customerEmail`. NOT a nested orders page — flat array, no pagination on detail.

**Verification:** `npx tsc --noEmit` → my files 0 errors (live errors only in orders-screen-agent's WIP `admin/orders/[id]/_components/StatusActions.tsx` — theirs); `npx eslint "src/app/admin/customers/**"` → 0 problems. No route smoke (deferred to runner Checkpoint 5), no vitest/e2e, no commit.

**Notes for orchestrator:** no dedicated "total customers" aggregate exists (`DashboardKpiDTO` lacks a customer count) → StatCards aggregate loaded rows (labeled by view; MVP page-1 = full set). `adminListCustomersSchema` field is `search`, not `query` (dispatch brief said query). StatCard `format` prop is `(value: string|number)` while `formatRWF` takes `number` → wrapped `(v) => formatRWF(Number(v))`.

**Next steps:** runner Checkpoint 5 once the remaining 4 dashboard screens land; admin e2e after.