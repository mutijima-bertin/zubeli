# Quality Gate — Milestone 5: Admin Dashboard (shell + 5 screens)

*Date: 2026-08-08 · Agent: quality-agent · Verdict: **PASS-WITH-BACKLOG** (no CRITICAL/HIGH open)*

## Scope

Dashboard milestone surface, verified end-to-end by `runner` Checkpoint 5 (build PASS, 24 routes, OWNER-UI smoke 10/10) and `e2e-runner` Phase E (admin e2e 11 specs / 29 tests GREEN). This gate re-ran the static gates + full suite and ran the reviewer suite over the Milestone 5 surface:

- Admin shell + widgets: `src/app/admin/layout.tsx`, `src/components/admin/*` (DataTable, StatCard, ChartCard, StatusBadge, FilterBar, AdminSidebar, AdminTopBar, SidebarNav, MobileAdminNav, LogoutButton, nav, icons, index)
- 5 screens + `_components`: `/admin` (overview), `/admin/products` + `new` + `[id]/edit` (inventory-agent), `/admin/stock` (stock-agent), `/admin/orders` + `[id]` (orders-screen-agent), `/admin/customers` + `[id]` (customers-screen-agent), `/admin/sales` (sales-agent)
- Backend consumption only (NOT re-gated): `src/actions/admin/{products,stock,orders,customers,sales}.ts` + `src/middleware.ts` — reviewed strictly for correct consumption by screens
- Admin e2e surface cited, not re-run: `e2e/specs/admin-*.spec.ts` (6 specs) + `e2e/pages/Admin*.ts` (6 POs) — `docs/reports/2026-08-08-e2e-runner-phase-e.md`

Reviewer suite (photographer model, one lens per domain, read-only, reports to quality-agent): `code-reviewer`, `security-reviewer`, `frontend-reviewer`, `backend-reviewer`, `database-reviewer`, `uiux-reviewer`, `accessibility-auditor`, `performance-optimizer`.

## Evidence (baseline — all green)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 errors, 2 known e2e warnings (CatalogPage unused Locator, account.spec unused DELIVERY_FEE_RWF — pre-existing, non-blocking) |
| Unit + integration | `npx vitest run` | 264/264 passed (15 files, 4.9s) |
| Production build | `npm run build` | PASS — 24 routes (11 `/admin/*` ƒ; `/admin/stock` dynamic note expected — cookies) |
| Admin e2e | (cited) `docs/reports/2026-08-08-e2e-runner-phase-e.md` | 11 specs / 29 tests GREEN (3m08s), tsc clean — no re-run needed (nothing in review casts doubt) |

## Findings (aggregated, severity-tagged)

| # | Sev | Reviewer domain | Finding | Location | Owner | Disposition |
|---|---|---|---|---|---|---|
| M1 | **MEDIUM** | Database/Perf | Stock KPI band (Products / Out of stock / Low stock / Items in stock) is computed from `listStockAdminAction({limit: 100})` — counts are silently wrong once the catalog exceeds 100 rows, and 2× list calls fire per page load. Root cause is the known gap: `adminListProductsSchema` has no low-stock/isPublished filter and no KPI endpoint. | `admin/stock/page.tsx:20-22`, `stock/_components/StockKpis.tsx:19-25` | stock-agent (schema: backend-agent) | backlog — needs backend filter or KPI endpoint; correct today at 30 products |
| M2 | **MEDIUM** | UIUX/Data | Customers KPI cards (Customers / Paying customers / Revenue (paid)) aggregate only the rows loaded so far (25/page) with no "of loaded" disclosure — values drift as pages are appended and are misleading until fully loaded. | `customers/_components/CustomersTable.tsx:88-89,97-117` | customers-screen-agent | backlog — label as "loaded rows" or move to server-side aggregate |
| L1 | LOW | Code/Security | `LogoutButton.signOut()` has no catch: a throwing `logoutAction()` (network) leaves an unhandled rejection and the redirect never runs. | `components/admin/LogoutButton.tsx:16-25` | dashboard-agent | backlog |
| L2 | LOW | Code/Security | `StatusActions.perform()` has the same unhandled-rejection shape on network failure (actions self-catch server errors, so only transport failures hit this). | `orders/[id]/_components/StatusActions.tsx:93-112` | orders-screen-agent | backlog |
| L3 | LOW | Code | Guest row key `guest:${phone}:${name}` can collide when two guest customers share phone+name (different email) → duplicate React keys. | `customers/_components/CustomersTable.tsx:18-20` | customers-screen-agent | backlog |
| L4 | LOW | UX | Movements ledger links product names to the storefront `/products/${slug}` — unpublished/deleted products 404 from inside the admin screen (dead-end navigation). | `stock/_components/MovementsLedger.tsx:93-98` | stock-agent | backlog |
| L5 | LOW | Performance | `listAll()` (categories) computes a filtered `productCount` subquery that the admin product/new/edit pages never use — trivial over-fetch at MVP scale. | `lib/db/categories.ts:23-26` consumed by `admin/products*` | inventory-agent | backlog |

## Known admin-side gaps (screen-agent flags) — reviewed, confirmed as EXPECTED minor items, NOT gate blockers

| # | Gap | Review decision |
|---|---|---|
| G1 | No ToastProvider in admin shell — Alert used; stock mounts a local ToastProvider | Confirmed deliberate; consistent enough (inconsistent only in that stock has toasts, others Alerts). Accepted. |
| G2 | No admin categories server action — inventory uses `db listAll` directly | Confirmed; server-shell use under the guarded layout, read-only query, no privilege issue. Accepted (tracked via L5/M1 backlog). |
| G3 | Stock LowStock list filter absent from `adminListProductsSchema` — stock filters client-side | Confirmed; folded into M1 (data-correctness at >100 products). |
| G4 | `StatCard.format` typing `(string\|number)→string` | Confirmed; screens coerce with `Number(value)` at call sites — type-safe in practice, no bug observed. Accepted. |
| G5 | No customers-count KPI on overview | Confirmed; overview KPI set is complete per brief (M2 captures the partial-aggregation variant on the customers screen itself). Accepted. |

## Carried forward from the storefront gate (NOT re-screened — no new CRITICAL/HIGH surfaced)

Backlog L1–L8 (force-dynamic product/catalog pages, getFieldErrors dup ×4, QuantityStepper aria-label, CheckoutFlow stale pageError, useCart.refresh silent fail, middleware next drops query, OrderTimeline upcoming dot 2.0:1, ProductGrid cache growth) + carry-forwards (XFF spoof, checkout idempotency pre-check, customers-admin unbounded query, payment-provider iface, layout cart-badge caching, guest-cart orphan on register). Re-verified as still absent only in the sense that no NEW manifestation appeared in the admin surface.

## What was fixed vs accepted vs backlog

- **Fixed this gate:** none required — no CRITICAL/HIGH findings.
- **MEDIUM M1–M2:** → backlog. Both are correctness-of-presentation issues bounded by current data volume (30 products, ~15 customers) and require either backend support (M1) or screen-label/server-aggregate changes (M2). Will be re-checked at the next gate; escalate to HIGH at the hosting milestone if still open.
- **LOW L1–L5:** → backlog additions (new this gate).

## Reviewer suite notes (per-domain assurance)

- **security-reviewer:** RBAC is three-layer (middleware /admin OWNER check → server layout `getSession` + role check → `requireAdminOrThrow` in every consumed action); IDOR impossible on admin fetches (all gated server-side); no `dangerouslySetInnerHTML` anywhere in admin (only the gated storefront JSON-LD exists repo-wide); search params (`?q`, `?status`, `?method`, `?from&to`) whitelist-validated server-side before reaching actions; React escapes all reflected copy (customer search echo, error strings). No injection/XSS/CSRF surface found.
- **backend-reviewer:** consumption-only pass — every action input matches the gated schemas (`limit` ≤ 100, `cursor`, `search` ≤ 100 chars); `confirmOrderPaymentAction({orderId})` correctly takes the bank reference from the stored order (UI copy confirms "nothing more is needed"); status buttons mirror exactly the gated lifecycle transitions; no screen bypasses an action.
- **database-reviewer:** no N+1 in screens — all server pages do one-pass fetches; DTOs arrive pre-aggregated; cursor pagination used on every list; M1 (limit-100 KPI truncation) is the only data-bound finding.
- **frontend-reviewer:** server/client boundaries clean; client islands are tightly scoped (forms, filters, dialogs); `noValidate` + server-zod authoritative everywhere; request-sequence guards prevent stale-response clobbering (ProductManager, MovementsLedger, StockTable); URL owns list filters (orders, customers, sales) so server pages re-render per filter.
- **uiux-reviewer:** empty/error/loading/disabled states present on every list and action; whole-card KPI links have sr-only labels; dialogs confirm all destructive/state-changing actions; mobile drawer + responsive tables handled (no horizontal scroll).
- **accessibility-auditor:** charts expose data via sr-only + `title`; timeline conveys state by caption text, not color alone; filter selects/search inputs all labeled (visible or sr-only/aria-label); DataTable row links use the stretched-link pattern keeping keyboard focus on a real anchor; no contrast failures found in admin (tones sourced from the shared format maps already AA-checked).
- **performance-optimizer:** no chart library (pure CSS bars); largest admin route chunk 9.15 kB; server-rendered pages with small client islands; `next/image` with `fill` + `sizes` on product thumbs; L5 minor over-fetch only.

## Next steps

1. Backlog sweep at the hosting milestone: M1 (stock KPI endpoint or schema filter), M2 (customers KPI disclosure/server aggregate), L1–L5.
2. `docs-writer` status + release-note updates (dashboard milestone complete).
3. Keep M1/M2 visible — re-check at next gate; escalate to HIGH if catalog/customers grow before hosting.
