# Runner — Commerce checkpoint (2026-08-08)

Full checkpoint after commerce wave (real photos seed + catalog filters + card polish + trust strip).

## Result table
| Check | Result |
|---|---|
| docker compose up | ok — both DBs healthy (5434/5435, foreign 5432/5433 untouched) |
| `npx tsc --noEmit` | PASS · 0 errors |
| `npm run lint` | PASS · 0 errors, 2 known e2e warnings (CatalogPage Locator, account DELIVERY_FEE_RWF) |
| `npx vitest run` | PASS · 282/282 (16 files, 6.7s) |
| `npx playwright test` | PASS · 29/29 (11 specs, 3.3m) — browse/home (5 featured) held, admin-stock restock dance held, admin-products at 38 products |
| `npm run build` | PASS · 23 routes / 10 `/admin/*` ƒ · DYNAMIC_SERVER_USAGE = 0 (verified ×2) |
| HTTP smoke :3000 | `/` 200 (exactly 5 featured: Angle Grinder, Cement 50kg, Claw Hammer, Extension Ladder, Power Drill), `/products` 200 (20 cards, 18 in stock), `/products/rhinoceros-bow-saw` 200 (new product + photo), guest `/admin` 307, `/api/health` 200 `{ok:true,db:'up'}` |
| Media | `stock/power-drill.jpg` 200 `image/jpeg` · `angle-grinder.svg` 200 `image/svg+xml` · `stock/rhinoceros-bow-saw.jpg` 200 |
| **`/products?minPrice=10000&maxPrice=50000&avail=in`** | **FAIL — 200 but EMPTY grid ("No tools match your filters"); ~12 products should match** |
| Dev DB audit | 38 products / featured 5 / safety-vest stockQty 0 / wheelbarrow → site-equipment / 2 OWNER users / 15 orders / 0 e2e hex-order markers (no leak) |

## Triage → backend-agent (1 round)
**BUG (real, reproducible):** `src/lib/storefront.ts` `getCatalogPage` lines 95–96 convert the RWF URL param to cents with `minPrice * 100` / `maxPrice * 100`. The money unit in this project is **1 RWF = 1 stored unit** (ADR 0004; `src/lib/format.ts:6`; seed `priceCents: 7500` = "7,500 RWF"; e2e `data.ts`: 65000 → "65,000 RWF" proudly asserting it). `minPrice=10000` therefore becomes `priceCents >= 1_000_000` while the most expensive product is 385,000 → **any RWF price filter always yields zero results**. Category counts echoed 0 under the filter for the same reason.
- Hidden from suites: `tests/unit/storefront.test.ts` codifies the ×100 as expected, and no e2e spec exercises a price filter — both suites pass while the feature is broken.
- Fix owned by **backend-agent** (catalog filter layer + their storefront tests, e.g. drop the ×100 in `getCatalogPage`, keep URL=RWF ↔ DB=unit identity; update `storefront.test.ts` minPriceCents expectations). `FilterSidebar` itself is correct (URL in RWF ints). Unit `catalogWhere` tests (cents-level) are fine.
- No seed-ripple, no flake, no PO label collision.

## Notes
- Total 20 product cards render on `/products` = first catalog page (CATALOG_PAGE_SIZE=20 of 37 published rows; 38 db rows − 1 unpublished waterproofing-membrane). Pagination is pre-existing behavior, not a regression.
- Dev server restarted in tmux `zubeli` on :3000 (stray :3000 next-server killed by PID first; user's :3001 untouched). E2E ran on test DB 5435 — no dev-DB pollution (audit above).
- No commits made; uncommitted wave changes left untouched.

Next: backend-agent fixes the price conversion; runner re-runs the filtered-URL smoke + vitest storefront tests (and full checkpoint if the fix ripples).