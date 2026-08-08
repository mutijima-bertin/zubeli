# 2026-08-08 — backend-agent — catalog filters

**Task:** extend the catalog query layer with multi-field search, RWF price range and availability filters.

**Files touched:**
- `src/types/api.ts` — added `ProductSort` (canonical now), `AvailabilityFilter` (`in|low|out`), `CatalogFilter { q, cat, sort, minPrice, maxPrice, avail }` (client-safe).
- `src/lib/db/catalog.ts` (NEW) — `catalogWhere(params)` shared predicate + `escapeLike` (`%`/`_`/`\` escaped, Prisma doesn't escape LIKE input). Search = name OR description OR category name (ILIKE).
- `src/lib/db/products.ts` — `listPublished` uses `catalogWhere`; `ListPublishedParams` gains `minPriceCents`/`maxPriceCents`/`stock`; `ProductSort` re-exported from api types (FilterSidebar/SortSelect imports unchanged).
- `src/lib/db/categories.ts` — `listAll(filter?)` counts products matching active search/price/avail (category itself excluded — additive filtering); homepage/admin bare calls unaffected.
- `lib/storefront.ts` — `getCatalogPage` gains optional `minPrice?`/`maxPrice?` (string RWF ints, parsed; invalid → absent, never 500) + `avail?` (`in`/`low`/`out`, else absent); converts RWF→cents at the boundary; feeds the SAME filters to listPublished + listAll counts; echoes full `CatalogFilter`.
- `tests/unit/storefront.test.ts` (17 tests) + NEW `tests/unit/catalog.test.ts` (10 tests — predicate: OR branches, %, price gte/lte, stock buckets, additive combine).

**Verification:** `npx tsc --noEmit` 0; full `npx vitest run` 282/282 (16 files, +18 over previously reported 264); `npm run lint` 0 errors (2 known e2e warnings); live smoke guest `/products` 200 + `/products?q=saw&minPrice=5000&maxPrice=50000&avail=in` 200 (page compiles pre-catalog-agent).

**Backward compat:** all new `getCatalogPage` params OPTIONAL — `app/(store)/products/page.tsx` still compiles untouched. `listAll()`/`listPublished()` zero-arg call shapes preserved (homepage, admin, cart actions).

**FIX (runner-found bug):** `storefront.ts` converted URL RWF ints with `×100`, but `priceCents` stores WHOLE RWF (1 RWF = 1 unit — ADR 0004, format.ts, seed 7500 → "7,500 RWF"), so every price filter matched ≥1,000,000 → zero products and collapsed sidebar counts. Removed the ×100 (identity: `minPrice ?? undefined`); confirmed no scaling hides in `catalog.ts`/`products.ts` (raw ints passed through, verified by grep); fixed the misleading "cents — callers convert" comments; test expectations sync'd to identity (`minPrice=10000` → `minPriceCents: 10000`). `CatalogFilter` echo untouched — RWF ints both ways. Verification: `tsc` 0 · `vitest run` **282/282** (16 files) · lint 0 errors; tsx protein against dev DB with the exact predicate: 37 published → range 10k–50k in-stock **13** (not 0, not all), min ≥100k **3**, out **1**; live `/products?minPrice=10000&maxPrice=50000&avail=in` + `?minPrice=100000` → 200.

**Next:** catalog-agent builds FilterSidebar/links against `CatalogFilter` (additive: minPrice/maxPrice/avail ride along q/cat/sort, IDENTITY units — no scaling) and passes the params on the page.