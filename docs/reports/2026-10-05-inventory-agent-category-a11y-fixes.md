# Inventory agent — Admin category accessibility fixes (2026-10-05)

## What was done
- Added per-row accessible names in `src/app/admin/categories/_components/CategoriesManager.tsx`: `aria-label="Edit {category.name}"` on the Edit button and `aria-label="{Activate/Deactivate} {category.name}"` on the toggle button (Delete already had one). Made deactivate confirm loading reflect in-flight state via `busyId === deactivateTarget.id` (consistent with row actions).
- Improved slug validation in `src/app/admin/categories/_components/CategoryForm.tsx`: when a slug is provided, enforce minimum length of 2 locally (in addition to existing pattern), matching the server schema.
- On edit success, re-synced local form state (`name`, `slug`, `description`, `isActive`) from the persisted result so the UI reflects what was saved (slug preview remains correct when left blank semantics unchanged).
- Extracted shared category option mapping: created `src/app/admin/products/_components/categoryOptions.ts` with `toCategoryOptions()` and `CategoryOption` type; refactored `src/app/admin/products/page.tsx`, `src/app/admin/products/new/page.tsx`, `src/app/admin/products/[id]/edit/page.tsx` to use it (removes duplication).

## Files touched
- src/app/admin/categories/_components/CategoriesManager.tsx (a11y labels, confirm loading state)
- src/app/admin/categories/_components/CategoryForm.tsx (slug min length, form state re-sync on edit success)
- src/app/admin/products/_components/categoryOptions.ts (new helper)
- src/app/admin/products/page.tsx (use helper)
- src/app/admin/products/new/page.tsx (use helper)
- src/app/admin/products/[id]/edit/page.tsx (use helper)

## Verification
- `npx tsc --noEmit` → 0 errors (full output empty).
- `npm run lint` → 0 errors/warnings (only the command header/footer lines shown).
- Manually confirmed aria-labels include the category name on Edit and Activate/Deactivate; Delete retained its label. Slug re-sync occurs only on the success branch for edit flows.
- `git status --porcelain` shows the changes (untracked new files/directories as expected given the existing uncommitted wave).

## Items addressed vs deferred
- Fixed (1) HIGH: per-row accessible names. (2) MEDIUM: slug not re-synced after successful save. (3) LOW: local slug pre-check omits server min length of 2. (4) LOW: deactivate confirm button pending state. (6) LOW: duplicated category-option mapping.
- Deferred (5) LOW: heading order h1→h3 via `src/components/ui/Card.tsx` — Card is shared UI owned by `frontend-agent` and not editable under this task scope; cannot fix without modifying shared components.

## Notes
- No shared components edited. No API routes, actions, lib, or e2e files touched. No tests added or run. The blocked-delete alert and deactivate confirm copy remain unchanged as required.
