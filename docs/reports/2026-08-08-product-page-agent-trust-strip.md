# 2026-08-08 — product-page-agent: PDP trust strip

## What was done
Added a compact buy-box trust strip under the Add-to-cart button on `/products/[slug]`.

## Files touched
- NEW `src/app/(store)/products/[slug]/_components/TrustStrip.tsx` — server component (zero client JS): `<ul class="mt-4 flex flex-col gap-1.5 border-t border-stone-200 pt-3">`, three `<li>` rows, each `IconCheck size-4 text-stone-500` (decorative) + `text-xs text-stone-600` copy.
- `src/app/(store)/products/[slug]/page.tsx` — import + render `<TrustStrip />` after the `AddToCartButton` wrapper in the buy box.

## Bullets (canonical copy, verified against site)
- "Delivery across Rwanda" (matches Footer "Pay on delivery across Rwanda")
- "Pay on delivery — cash or MTN MoMo / Airtel Money" (exact TrustSignals wording "MTN MoMo / Airtel Money", "Pay on delivery")
- "Bank transfer available"

## Shared components consumed
- `IconCheck` from `@/components/ui` (reused, not edited — same stroke family as TrustSignals).

## Verification
- `npx tsc --noEmit` → exit 0; `npx eslint` on both touched files → 0.
- Live :3000 smoke: `/products/angle-grinder` 200, all 3 bullets present in HTML; renders identically when out-of-stock (strip sits below the disabled button — no conditional).
- e2e PDP spec untouched: AddToCartButton/QuantityPicker/SpecsTable unchanged.
- Note: dev DB still has fingerprint pollution from the 2026-08-08 e2e incident (`/products/safety-vest` 404s in dev although seed defines it) — unrelated to this change; `npm run db:reset` (dev) recommended before demo.

## Reviewers should check
- Divider feel: `border-t stone-200`, `pt-3`, `mt-4` daisy-chains after out-of-stock notice too (stone-600 text = 7.6:1 contrast on white, AA at text-xs).