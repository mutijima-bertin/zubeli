# 2026-08-09 — backend-agent — friendly slug-collision errors

**What was done:** admin product create/update now pre-check the slug BEFORE writing, throwing an exact, human-readable error instead of the generic P2002 "A record with that value already exists" (which surfaces as "Couldn't create product / A record with that value already exists").

**Exact messages (curly quotes as spec'd):**
- `A product named "Claw Hammer 500g" already uses the slug "claw-hammer". Delete it or pick a different slug.`

**Files touched:**
- `src/lib/products-admin.ts` — new pure helper `slugConflictMessage(existingName, slug)` + `throwSlugConflict`; `createProduct` pre-checks `tx.product.findFirst({ where: { slug, deletedAt: null }, select: { name: true } })` inside the tx right before create (soft-deleted slugs pass — partial unique index only constrains LIVE rows); `updateProduct` pre-checks with `id: { not: productId }` (self never conflicts; no query when slug unchanged or absent). P2002 race fallback untouched in `src/lib/errors.ts` (2 admins same slug → generic CONFLICT, as designed).
- `tests/unit/products-admin.test.ts` (NEW, 9 tests, RED/GREEN via `vi.mock('@/lib/db')` — same pattern as orders-admin.test.ts): live-collision throws ValidationError w/ message + `details.fieldErrors.slug` BEFORE create; soft-deleted slug reusable; ledger RESTOCK on create / none at stock 0; update collision (self-exclusion verified on the findFirst args); own-slug no-op saves skip guard; free-slug switch; soft-deleted owner ignored; NotFound for unknown id. Plus a copy-format test.
- Actions unchanged — existing `toActionResult` already maps ValidationError → `{code:'VALIDATION', message, details}` (errors.ts AppError branch).

**VERIFY: tsc 0 · eslint 0 (2 known e2e warnings) · vitest 291/291 (17 files, +9) · lint 0.**

**FORM-PATH FINDING (read-only, inventory-agent note):** `ProductForm.tsx:127-129` derives `pageError = error && error.code !== "VALIDATION" …` — so a VALIDATION error does NOT render in the page Alert, but `details.fieldErrors` DO render inline under the Slug input (FormField `error={fieldErrors.slug}`). The friendly message therefore reaches the user today, inline at the field. The old generic message showed in the "Couldn't create product" banner because P2002 mapped to CONFLICT (≠ VALIDATION). If a page-level banner is preferred instead of/alongside the inline one, product form owner may relax `pageError` (e.g. show for any non-ok result whose `message` isn't already rendered inline). No form edit was made (out of scope).

**Next steps:** none blocking — eager to wait for inventory-agent's banner decision; e2e untouched (admin-products PO submits unique slugs; assertions on Alert only when configured).