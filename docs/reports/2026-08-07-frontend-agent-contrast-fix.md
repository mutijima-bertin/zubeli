# Contrast Fix — Foundation (frontend-agent)

*Date: 2026-08-07 · Agent: frontend-agent · Task: quality-gate FAIL items (HIGH a11y + 2 MEDIUM)*

## What changed (5 files, nothing else)

1. **`src/components/ui/Button.tsx:10`** — primary variant: `bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800` → `bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900`. Base/hover/active all stay darker than the new base so the press states remain visible.
2. **`src/components/storefront/CartBadge.tsx:25`** — count badge `bg-brand-600` → `bg-brand-700`.
3. **`src/components/storefront/Header.tsx:27`** — skip-link `focus:bg-brand-600` → `focus:bg-brand-700` (same white text, now 5.02:1).
4. **`src/app/globals.css:29`** — `:focus-visible` outline `#f59e0b` (brand-500) → `#b45309` (brand-700); width 2px / offset 2px unchanged. Comment updated.
5. **`src/lib/hooks/useProducts.ts`** — removed the duplicated `"use client"` + docstring block (lines 7-12); kept one accurate header. Zero logic change.

No tailwind token change needed (`brand-700` already in palette); no test asserted old colors (verified by grep).

## Contrast values (computed, WCAG 2.2 relative luminance)

| Pair | Before | After | Requirement |
|---|---|---|---|
| white on brand-600 `#d97706` | 3.19:1 ❌ | — | 4.5:1 (1.4.3) |
| white on brand-700 `#b45309` | — | **5.02:1 ✅** | 4.5:1 |
| white on brand-800 `#92400e` (hover) | — | 7.09:1 ✅ | 4.5:1 |
| white on brand-900 `#78350f` (active) | — | 9.07:1 ✅ | 4.5:1 |
| focus ring brand-500 `#f59e0b` on white | 2.15:1 ❌ | — | 3:1 (2.4.13) |
| focus ring brand-700 `#b45309` on white | — | **5.02:1 ✅** | 3:1 |
| brand-700 on stone-50 / stone-100 (page bgs) | — | 4.81 / 4.60:1 ✅ | 3:1 |

## Verification evidence

- `npx tsc --noEmit` → exit 0, no errors
- `npm run lint` → exit 0, no warnings
- `npx vitest run` → **227 passed / 0 failed** (12 files), 3.88s
- Build not run: no tailwind token change (optional per task brief).

## Next steps

Re-run the quality gate — expectation: PASS on the a11y HIGH, then Milestone 2 (homepage-agent).
