# inventory-agent — admin categories screens + product-select fix

**Date:** 2026-10-05 · **Scope:** `/admin/categories` CRUD screens + task-4 defect fix in `src/app/admin/products/**`

## What was done
- **New routes:** `/admin/categories` (list), `/admin/categories/new` (create), `/admin/categories/[id]/edit` (edit) — matching the `/admin/products*` structure (server shell → client manager/form, Card + FormField + DataTable/FilterBar + Dialog confirm, toast via `useToast`).
- **Files created:** `src/app/admin/categories/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `_components/CategoriesManager.tsx`, `_components/CategoryForm.tsx`.
- **Contract consumed (read-only):** `listCategoriesForAdmin()` / `getCategoryById()` from `src/lib/db/categories.ts`; actions `createCategory` / `updateCategory` / `deleteCategory` / `toggleCategoryActive` from `src/actions/admin/categories.ts`; `categorySlugify` + `CATEGORY_SLUG_PATTERN` from `src/lib/validation/category.ts`; widgets from `@/components/ui` + `@/components/admin`.
- **Blocked delete:** dialog stays open and shows the server message (with `details.productCount`) in an inline danger Alert + reassign-or-deactivate hint. **Deactivate:** confirm dialog states the category is hidden while "its N products stay published and sellable"; success toast repeats it. Product counts shown are the contract's `productCount` (never computed client-side).
- **Task-4 fix (diff):** `products/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx` switched `listAll()` → `listCategoriesForAdmin()`; `CategoryOption` (ProductForm + ProductManager) gained required `isActive`, and both `<select>`s render `Name (inactive)` for inactive rows — a product whose category was deactivated keeps its selected option. e2e labels ("Power Tools" etc.) are active seeds → unchanged.

## Verification
- `npx tsc --noEmit` → **0 errors**
- `npm run lint` → **0 errors**, 1 pre-existing warning (`e2e/pages/CatalogPage.ts` unused `Locator`)
- `npm test` → **356/356 passed (21 files, 7.22s)**
- Smoke deferred: a dev server already listens on :3100 (port 3000 untouched, dev DB untouched).

## Notes / not done
- Brief task 3 said `/admin/categories/[id]` but allowed-files said `[id]/edit` → built **`[id]/edit`** (mirrors products). A redirect from `/admin/categories/[id]` was not added; say the word if wanted.
- Load errors (DB throw) on list/edit render inline Alerts; unknown id → `notFound()` 404.
