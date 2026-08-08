# 2026-08-08 — catalog-agent — price + availability filters

Wired minPrice/maxPrice/avail into the catalog UI against the backend contract (getCatalogPage + CatalogFilter, backend-agent 2026-08-08). All filter actions are URL navigation — no local filter state.

## Files changed
- `src/app/(store)/products/page.tsx` — searchParams extended (minPrice/maxPrice/avail, firstParam'd → getCatalogPage); filter-aware empty state ("No tools match your filters" when price/avail active); FilterSidebar now receives applied.price bounds + avail.
- `src/app/(store)/products/_components/FilterSidebar.tsx` — shared SidebarContent (dialog + desktop rail): Price group (2 number inputs + Apply, useId labels, digit-only submit, empty = strip, router.push preserving q/cat/sort/avail, drops cursor); Availability group (3 toggle links, aria-pressed, active = removes itself, preserves everything else); "Clear all filters" link only when any filter active; buildHref now carries price/avail.
- `src/app/(store)/products/_components/ProductGrid.tsx` — cache base extended to q|cat|sort|minPrice|maxPrice|avail (stale-page fix: price/avail change with same q/cat/sort must reset the accumulation cache).
- SortSelect.tsx / PaginationBar.tsx — inspected, zero changes: both spread `searchParams.toString()`, so new params ride along automatically.

## Verification
- `npx tsc --noEmit` → 0; `npx eslint` on all 5 catalog files → 0.
- Live :3000 round-trip: `/products?minPrice=10000&maxPrice=50000&avail=in` renders; category chips + low/out links preserve the range; active avail link drops the param; `/products?avail=out` shows ONLY safety-vest card (server filtering real); plain /products shows no clear-all, no pressed state; no cursor in any filter link; useId prevents desktop/dialog id collisions (Dialog no-ops when closed).

## Reviewers look at
- aria-pressed toggle semantics on availability links; visible labels + inputMode numeric on price form; clear-all visibility; ProductGrid cache key correctness (back/forward across filter combos).