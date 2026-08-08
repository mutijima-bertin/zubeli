# 2026-08-07 catalog-agent — gate fix F1 (FilterSidebar count chip contrast)

## What was done
- Fixed quality-gate finding F1 (WCAG 2.2 AA 1.4.3, MEDIUM): category-count chips in the catalog filter sidebar used `text-stone-400` at 12px (≈ 2.44:1).
- Change (surgical, one class, one line): `text-stone-400` → `text-stone-500` (≈ 4.6:1 on white/stone-50) in `src/app/(store)/products/_components/FilterSidebar.tsx:125`. Surrounding classes (`text-xs tabular-nums`), markup, and the rest of the file untouched. Fix applies to both desktop sidebar and mobile drawer since they share `CategoryNav`.

## Files touched
- `src/app/(store)/products/_components/FilterSidebar.tsx` (1 line)

## Verification evidence
- `npx tsc --noEmit` → exit 0, 0 errors
- `npm run lint` → 0 problems
- `npx vitest run` → 264/264 passed (15 files) — no test asserts the old/new color
- Grep for `stone-400|stone-500`: no matches under `tests/`; other `text-stone-400` usages (CategoryDropdown, MobileMenu, SearchBox, etc.) are frontend-agent foundation files — outside catalog-agent scope, not touched.

## Next steps
- F2 (account-agent) and F3 (product-page-agent) gate fixes still dispatch-queued; then re-gate → Phase D e2e.
