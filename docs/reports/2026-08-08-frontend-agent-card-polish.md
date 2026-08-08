# Report — frontend-agent: ProductCard polish (2026-08-08)

**Task:** product-card design polish per ui-ux-pro-max skill set (sections 3 style, 4 density, 5 responsive, 8 forms/touch) + component-specs.md + brand consistency checklist. Files touched (2, both mine):

## Changes
- `src/components/storefront/ProductCard.tsx`
  - `:45` image container `aspect-square` → `aspect-[4/3]` (object-cover, hover zoom, overflow-hidden kept)
  - `:64` info block padding `p-4 pb-2` → `p-3 pb-2`; `:83` action row `px-4 pb-4` → `px-3 pb-3` (tighter proportions with shorter image + new line); h3 line-clamp-2 + Price md kept
  - `:72-80` new stock line under Price, thresholds reuse the badge consts (`outOfStock` = ≤0, `lowStock` = 1–5): `In stock` → `text-success-700` (Badge/Alert success text tone, 5.08:1 AA), `Only N left` → `text-amber-700` (Low-stock badge amber family, 4.99:1 AA), `Out of stock` → `text-danger-600` (Toast/FormField danger token, 4.9:1 AA). Plain `<p>`, no interactive role. Danger Badge on image unchanged
- `src/components/storefront/QuickAddToCartButton.tsx`
  - `:82` visible label `"Add"` → `"Add to cart"` (sm = h-10 text-sm, fits full-width card button; no wrapping needed). aria-label `Add ${slug} to cart` unchanged (accessible name); disabled "Out of stock" state, spinner, toast all untouched

## Verification
- `npx tsc --noEmit` → 0 errors; `npx eslint` on both files → 0
- Live :3001: `/` 200, `/products` 200 — HTML contains aspect-[4/3] on 13 catalog + 10 home cards, compiled CSS has `.aspect-\[4\/3\]{aspect-ratio:4/3}`, In stock ×9 (success-700), Only 1/4/2/5 left ×4 (amber-700), aria-label ×13 matching buttons, text-danger-600 compiled
- e2e safe: browse/cart/account specs never touch the card button (PDP "Add to cart" via `ProductPage.ts` untouched; card accessible name = aria-label, unchanged)

## Next steps
- None (self-contained). Stock line uses stockQty only per review "for now" — revisit when ProductCardDTO gains lowStockThreshold (flag to database-agent stands in docblock)

Report: docs/reports/2026-08-08-frontend-agent-card-polish.md