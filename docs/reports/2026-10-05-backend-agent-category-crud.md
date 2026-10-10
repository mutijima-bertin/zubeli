# Admin category CRUD — server contract

*Date: 2026-10-05 · agent: backend-agent*

## What was done
NEW contract for `/admin/categories` (backend only, no UI): 4 OWNER-only server actions + admin DB helpers,
plus the storefront `isActive` filter. zod-validated, rate-limited, discriminated-union returns, FK-safe deletes.

## Files touched (nothing else)
- `src/actions/admin/categories.ts` (NEW) — `createCategory(input)`, `updateCategory(id, input)`,
  `deleteCategory(id)`, `toggleCategoryActive(id)`: all `Promise<ActionResult<…>>` (`{ok:true,data}` |
  `{ok:false,error:{code,message,details?}}`, fieldErrors at `error.details.fieldErrors`), each
  `requireAdminOrThrow` → `assertRateLimit('admin-category:${ip}', {limit:120,windowMs:60s})` → zod →
  repo → `revalidatePath('/','/products','/admin/categories','/admin/products')`.
- `src/lib/db/categories.ts` (EXTENDED; `listAll` signature unchanged) — NEW `AdminCategory`
  (`id,name,slug,description,isActive,productCount,createdAt/updatedAt ISO`), `listCategoriesForAdmin()`,
  `getCategoryById(id)`, `createCategory`, `updateCategory`, `deleteCategory`, `toggleCategoryActive`,
  `categorySlugConflictMessage`. **Only existing export changed: `listAll`** — now `where:{isActive:true}`
  (it IS the storefront nav/homepage/catalog-sidebar query; its other 3 callers are the admin product
  pages, whose selects will now show active categories only — recommend those pages switch to
  `listCategoriesForAdmin()`, their owners' call, not mine).
- `src/lib/validation/category.ts` (NEW, flagged: shared zod schemas genuinely didn't exist; `'use server'`
  files may only export async fns, so schemas can't live in the action file) — `createCategorySchema`
  (slug auto-derived via `categorySlugify` when absent, derived value re-validated → `fieldErrors.slug`),
  `updateCategorySchema` (all-optional; never re-derives slug on rename), `categoryIdSchema`.
- `tests/integration/admin-categories.test.ts` (NEW) — 17 tests, real 5435 DB, rows prefixed `cat-crud-`,
  cleaned in afterAll; sessions re-upserted per call (actions.test.ts TRUNCATEs `Session` in parallel).

## Rules & evidence
- **Product-visibility rule:** deactivating a category hides ONLY the category (nav, homepage, filter chips).
  Products keep their own `isPublished`/`deletedAt` gates — grep proves no product query reads
  `category.isActive`; `?cat=<inactive-slug>` still lists its products. Stated, implemented, not changed.
- Delete blocked on any referencing product (counts ALL rows incl. unpublished/soft-deleted — matches the
  schema's `onDelete: Restrict`): `"Category has 4 products. Reassign them first."` → `VALIDATION` + `details.productCount`.
- Slug collisions: pre-check → friendly `fieldErrors.slug` (product pattern, P2002 → CONFLICT fallback).
- Rate limiting: sibling admin actions actually DON'T rate-limit (only auth/checkout do) — flagged deviation;
  followed the mandated instruction with the existing `register:${ip}`-style key, no edit to `rate-limit.ts`.
- Evidence: `npm test` ×2 → **21 files / 356 tests PASS** (baseline 20/339, +17); paired run with
  actions.test.ts ×2 → 41/41; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (1 pre-existing
  e2e warning); leak check on 5435: 0 leftover rows/buckets.

## Could not do / next
- No list action exported (screen reads `listCategoriesForAdmin()` server-side, like sibling admin pages);
  no `CategoryDTO` in `types/api.ts` (outside allowed files) — `AdminCategory` lives in `src/lib/db/categories.ts`.
- Orchestrator: dispatch the 3 admin product pages to swap `listAll` → `listCategoriesForAdmin`.
