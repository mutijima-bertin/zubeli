# Admin product screens (Inventory) — 2026-08-07

Milestone 5: `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit` built on the dashboard shell + widgets. Consumed only; zero edits to shell, widgets, actions, libs, types, validation, prisma, storefront or ui foundation.

## Files created (7)
- `src/app/admin/products/page.tsx` — server shell; metadata **"Products | Admin — Zubeli"**; parallel fetch of first page (`listProductsAdminAction({limit:25})`) + categories (`listAll` db repo — NO categories action exists); delegates to ProductManager; error/empty states with "New product" CTA.
- `src/app/admin/products/_components/ProductManager.tsx` (client) — search (debounced `useDeferredValue`) + category select + status filter; cursor pagination via `DataTable` (load more); publish/unpublish toggle per row; delete behind confirm `Dialog` (soft delete, `deleteProductAction`, success → row removed + `router.refresh()`); Alert-bar feedback (admin shell has no ToastProvider — used Alerts per brief). Empty-state + skeleton loading via widget. Product name cell links to edit via explicit `Link` (NOT DataTable `rowLink` — the stretched whole-row overlay would have covered the Publish/Delete buttons; same call stock-agent made).
- `src/app/admin/products/_components/ProductForm.tsx` (client) — create/edit shared form: name, slug, category (select), price (RWF integer ←→ `priceCents` 1:1 per ADR 0004), initial stock (= RESTOCK on create; ADJUSTMENT on edit), low-stock threshold, description, image URLs list (MVP: URL strings, ≤8), published/featured checkboxes; optional controlled `isPublished`/`featured` (edit screen sync via quick actions); fieldErrors via `FormField`, page-level `Alert` (CONFLICT/P2002 and others).
- `src/app/admin/products/new/page.tsx` — server: categories fetch, renders form in create mode, metadata "New product | Admin — Zubeli".
- `src/app/admin/products/[id]/edit/page.tsx` — server: `getProductAdminAction` (NOT_FOUND → notFound()), categories; metadata "Edit product | Admin — Zubeli". Space for surprises: unknown-id error → back link.
- `[id]/edit/_components/EditProductClient.tsx` — client: form + sidebar quick actions (publish/unpublish via `togglePublishAction`, delete via `deleteProductAction` with confirm Dialog + redirect to list), controlled sync with the form's checkboxes.

## Contracts consumed
- Actions: `listProductsAdminAction` → `ActionResult<Page<ProductDTO>>`, `getProductAdminAction` → `ActionResult<ProductDTO>`, `createProductAction`, `updateProductAction`, `togglePublishAction`, `deleteProductAction` → `ActionResult<{success:true}>` (all admin-guarded).
- Widgets: `DataTable` (+ typing), `FilterBar`, `StatusBadge`, foundation `Button/Card/Input/Select/Textarea/FormField/Alert/Dialog/Badge`, `formatRWF`, `Page/ProductDTO/ApiError` types.

## Gaps / notes
1. No categories action exists → pages call the db repo `listAll()` server-side (also used by storefront helper). Consider a `listCategoriesAdminAction` for the API surface (backend-agent follow-up).
2. Status filter (published/unpublished) is client-side over loaded rows — `adminListProductsSchema` has no `isPublished` param (only search/categorySlug/includeDeleted), so server-side status filtering needs a validation-schema change.
3. Admin shell has no ToastProvider → all feedback uses inline Alerts (per brief's "otherwise Alert" fallback; also flagged by stock-agent as a dashboard-agent gap).
4. Images are URL strings (MVP has no upload). Placeholder hint in the form points to `/images/products/<slug>.svg`.

## Verification
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors (2 pre-existing warnings in e2e/* WIP files, not mine)
- No dev-server smoke (deferred to runner Checkpoint 5).