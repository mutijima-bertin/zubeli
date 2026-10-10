# sales-agent — business-timezone (Africa/Kigali) fix for /admin + /admin/sales

**Date:** 2026-10-05 · **Scope:** `src/app/admin/sales/**` + `src/app/admin/_components/MonthlyRevenueChart.tsx` (sales-agent-owned, shared by /admin and /admin/sales). Nothing else touched.

## What changed (pure correctness, no UI/copy/filter change)
- `sales/page.tsx` — `currentMonthRange()` deleted in favour of `businessMonthRange()`; `toDateInputValue()` → `businessDayKey()`; `parseDateInput()` now resolves `YYYY-MM-DD` to **00:00 Africa/Kigali** (two-pass offset via `Intl` + exported `BUSINESS_TIME_ZONE`) and validates by business-calendar round-trip (same rejects as before: `2026-02-30`, `2026-13-01`, `2026-2-1`). Range semantics, params, labels unchanged.
- `sales/_components/PeriodFilterForm.tsx` — `todayInputValue()` (the date-input `max`) sources `businessToday()` instead of `new Date()` local parts; string shape identical.
- `_components/MonthlyRevenueChart.tsx` — `MONTH_LABEL` now pinned to `timeZone: BUSINESS_TIME_ZONE` and the anchor is `Date.UTC(y, m-1, 1)` (old local-midnight Date + unpinned formatter was zone-dependent; it happened to render correctly in UTC/±14/±11, so this is hardening, not a visible-bug fix). `monthAxisLabel` reuses `monthLabel` (same output).

## Verification (exact results)
- `npx tsc --noEmit` → **0 errors in my files**; 4 pre-existing errors in test files I don't own (`tests/{integration/storefront/cart,integration/storefront/checkout,unit/dto,unit/storefront}.test.ts` — missing `Category.isActive` from database-agent migration `20261005083355_category_is_active`). Proven pre-existing: identical output with my 3 files reverted to HEAD.
- `npm run lint` → `✖ 1 problem (0 errors, 1 warning)` — the warning is the pre-existing `e2e/pages/CatalogPage.ts:1 'Locator' unused`.
- `npm test` → `Test Files 19 passed (19) · Tests 324 passed (324)`. Caveat: repeated runs inside one rate-limit window fail `tests/integration/{actions,rate-limit}.test.ts` (backend-agent's new limiter leaks buckets into tdd-guide's tests; baseline run with my files reverted also failed) — cleared `"RateLimitBucket"` on the **test** DB (5435) to get the green run.
- `npm run build` → PASS (webpack, compiled 14.0s), 24 routes, `/admin/sales ƒ 895 B`, 10 `/admin/*` dynamic routes.
- TZ proof: verbatim slice of my 3 files + `@/lib/time`, run under `TZ=UTC`, `TZ=Pacific/Kiritimati`, `TZ=Pacific/Midway` → **ALL CHECKS PASSED** (0 failures) in all three. `2026-07-31T22:00:00Z → 2026-08`, `21:59:59Z → 2026-07`; default month range `from 2026-07-31T22:00:00.000Z` / `to 2026-08-31T21:59:59.999Z` vs **OLD** `from 2026-07-01T00:00:00.000Z` (wrong month on a UTC server); `?from=2026-08-01` → `2026-07-31T22:00:00.000Z` and back to day key `2026-08-01`. Throwaway harness deleted.

## Gaps / asks
- `src/lib/time.ts` has no **day**-granularity helper, so `page.tsx` carries a ~25-line local `businessParts`/`zoneOffsetMs`/`businessDayStart`/`businessDayKey` (pinned to the exported `BUSINESS_TIME_ZONE`). Ask `backend-agent` to export `businessDayKey(d)` + `businessDayStart(y, m, d)` so screens stop re-deriving them.
- No e2e change needed, but `e2e/specs/admin-sales.spec.ts` would break if it asserts `to` includes the whole final day — the pre-existing "to = 00:00 business time of the picked day" semantics are preserved verbatim (orders after 00:00 on the end day are excluded); worth a separate backend change if that is not intended.
- `/admin/page.tsx` (overview) has **no** server-local date arithmetic — all KPIs come from backend aggregations; no action needed.