# Sales-agent — Revenue chart v2 (audit item #4)

*2026-08-08 — sales-agent*

## What was done
- `MonthlyRevenueChart.tsx` (only file touched) upgraded per audit item #4: direct value labels, year-aware axis, type floor.

## Files touched
- `src/app/admin/_components/MonthlyRevenueChart.tsx`

## Changes (audit item #4: `chart#direct-labeling`, `chart#time-scale-clarity`)
- Value labels: compact RWF ("12.5M"/"950K"/"0") direct above each bar — `text-xs font-medium tabular-nums text-stone-600`, visible ≥sm, `aria-hidden` (data lives in sr-only + hover title).
- Axis: "Aug '26" year-aware labels at md+ (12 columns too narrow below md → month-only fallback, per `chart#responsive-chart`); both from timezone-safe parts, no `Date` strings.
- Type floor: `text-[11px]` → `text-xs` (was the only violation in my scope; ProductForm/CartBadge occurrences are other owners').
- Kept: `MonthlyRevenueChart({ months })` prop shape, ChartCard usage in both pages, pure-CSS bars (no deps), `h-48` + `gap-1.5 sm:gap-3` + MAX_BAR_HEIGHT 136, sr-only line + hover `title` unchanged, zero-revenue stubs.
- Compact formatter (`compactRWF`/`trimZero`) lives locally in the chart file — `src/lib/format.ts` (shared, has only `formatRWF`) untouched.

## Verify
- `npx tsc --noEmit` → 0 errors.
- `npx eslint` on all three owned files → 0 problems (after fixing one unused-destructure warning in `monthAxisLabel`).
- Route smoke deferred per brief (guest /admin → 307; charts render server-side only).

## Next steps
- None required; report to orchestrator: item #4 closed. Remaining audit items split by owners (DataTable sort #14 → dashboard-agent, admin toast #15b → dashboard-agent, checkout mobile #12 → checkout-agent).