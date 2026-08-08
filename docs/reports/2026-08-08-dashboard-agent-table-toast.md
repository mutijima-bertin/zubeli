# 2026-08-08 — dashboard-agent — DataTable sort + admin toast + StatCard tabular-nums

**Scope:** ui-ux-pro-max audit items #14 (DataTable column sorting), #15b (admin toast parity), StatCard tabular-nums.

**Done**
- `src/components/admin/DataTable.tsx` — column contract gained `sortable?: boolean` + `sortValue?: (row) => string|number` (default accessor = `row[key]`). When ANY column is sortable, `DataTable` delegates to a new client twin; otherwise renders the exact previous markup (no client boundary). Constraint met: no screen changed; existing labels/aria/default order identical (sort is off by default and stable — ties keep original order).
- `src/components/admin/SortableDataTable.tsx` (new, `"use client"`) — internal twin: `useState` sort key/dir, click toggles asc→desc, new column resets to asc; `<th aria-sort="ascending|descending">`, header is a real `<button>` (global focus ring applies); inline-SVG carets (no lucide dep in package.json); numeric values compare numerically, text via `localeCompare` with `numeric: true`; load-more/empty/error/footer identical.
- `src/components/admin/icons.tsx` — added admin-owned `IconChevronUp`, `IconChevronDown`, `IconSort` (mirrors design-system chevron style; storefront icon set untouched).
- `src/app/admin/layout.tsx` — mounted the storefront `ToastProvider` (from `@/components/ui`, NOT edited — frontend-agent's) around the shell; server layout → client provider wrapping `{children}` is the supported pattern. Audit #15b gap closed.
- `src/components/admin/StatCard.tsx` — `tabular-nums` on the KPI value (audit #2/number-tabular).

**Why the twin:** DataTable is consumed by server components (`PurchaseHistoryTable`, `TopProductsTable`) that pass `render`/`rowKey` functions — adding `"use client"` to their import would crash at runtime. Delegation-only-on-opt-in keeps all 27 current usages untouched.

**Verification**
- `npx tsc --noEmit` → 0. `npx eslint` on the 5 touched files → 0 warnings/errors.
- Live curl vs the running dev server (:3001, user's dev DB 5434 — throwaway `Session` row inserted/verified/DELETE 1 cleaned): guest `/admin` → 307 `/login?next=%2Fadmin`; owner `/admin` 200 + `/admin/sales` 200; served HTML contains the toast viewport (`aria-live="polite"`), 46× `tabular-nums` incl. StatCard values ("1,310,100 RWF"); sidebar nav intact.

**Notes for screen agents (adoption)** — sortable use SKILL: you must be a client component ("use client"); add `sortable: true` on a column (optionally `sortValue` for formatted/derived columns, e.g. sort raw `createdAt` not the rendered date). Stock's local ToastProvider mount can be dropped later (now redundant under the shell provider) — that's stock-screen-agent's call.