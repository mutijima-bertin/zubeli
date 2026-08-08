# Catalog screen — /products (C-1)

- **Date/agent:** 2026-08-07, catalog-agent
- **Scope:** `src/app/(store)/products/` — Phase C-1 of storefront-build-plan. /products was 404; now live.

## What was built
- `page.tsx` (server): awaits `searchParams` (single source of truth for q/cat/sort/cursor) → `getCatalogPage` → serializable props; dynamic h1/subtitle echo applied filters; EmptyState with reset link; static metadata.
- `_components/FilterSidebar.tsx` (client): category chips + counts from `getCatalogPage().categories`; links preserve q + sort, never carry cursor; mobile → shared `Dialog` slide-in drawer, lg+ → sticky inline sidebar; `aria-current="page"` on active chip.
- `_components/SortSelect.tsx` (client): hidden `Label` + shared `Select`; `useRouter().push` inside `useTransition`, deletes `cursor`; `aria-busy` while pending.
- `_components/ProductGrid.tsx` (client): renders shared `ProductCard` grid; accumulates pages via a `q|cat|sort|cursor`-keyed cache — cursor push appends, filter/sort change or back/forward restores the exact list (no duplicates); live count with `role="status"`.
- `_components/PaginationBar.tsx` (client): wraps shared `PaginationLoadMore`; appends `cursor` to URL preserving q/cat/sort; `scroll:false`.

## Foundations consumed (imported only, never edited)
`Button`, `Select`, `Label`, `Dialog`, `EmptyState`, `Skeleton`, `PaginationLoadMore`, `IconSearch`, `cx` from `@/components/ui`; `ProductCard` from `@/components/storefront`; `getCatalogPage` from `@/lib/storefront`; types only from `@/lib/db/*` and `@/types/api`.

## Verification (scope tier)
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — clean (0 warnings/errors)
- No dev smoke (deferred to runner Checkpoint 3 per fast-dispatch protocol).

## Notes for reviewers
- **Load-more mechanism:** no public catalog server action exists, so PaginationBar pushes `cursor` to the URL and ProductGrid accumulates server-rendered pages client-side (URL stays the single source of truth). Check cache-keyed restore logic for back/forward edge cases.
- No add-to-cart on grid (per brief); ProductCard `actions` slot unused.
- `[slug]` route (product-page-agent) coexists under `products/` — no file overlap.
- Gaps: none; all required primitives existed.
