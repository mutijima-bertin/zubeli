# UI/UX Review — Landing (Home) Design Audit

*2026-08-09 — uiux-reviewer (READ-ONLY; no files edited)*

## Verdict
**0 P0 / 3 P1 / 8 P2.** Functionally green + a11y-solid; the gap is craft, not
correctness. P1=HIGH, P2=MEDIUM/LOW (mapping per prior pro-max audit). Grounding:
read all 4 vendored SKILLs + quick-reference.md; design-intel `search.py
"construction tools ecommerce industrial" --design-system` (hero-centric pattern,
#EA580C accent, oversized display type). Evidence: live curl :3000 (200; 4 featured
cards, hero SVGs, 10 category chips, 4 trust cards) + all 5 home components,
ProductCard, Button, Price, tailwind.config, globals.css, Footer, storefront.ts.

## TOP-3 structural problems (why it reads "not attractive")
1. **Hero speaks a different visual language than the store** — 4 flat SVG illustrations in the
   hero collage vs real photography below it; those images are the LCP and render
   `loading="lazy"` (Hero.tsx:61-88); the `-z-10` orange glow (Hero.tsx:59) paints behind the
   section (no stacking context) = invisible dead decoration.
2. **CategoriesShowcase is a "0 products" graveyard** — with ~4 active products, 7-8 of 10
   text-only bordered chips show "0 products"; the section advertises emptiness.
3. **No narrative arc / no closing CTA** — five equal-weight static bands (py-12/16, same
   text-2xl/3xl headings, no kickers), TrustSignals duplicates DeliveryBanner's flat-fee copy
   and 3 of 4 cards repeat the payment story; page ends flat after trust cards.

## Implementation list (homepage-agent; 10 items — THIS IS THE BRIEF)
1. **Hero.tsx** collage → real photos `/images/products/stock/{power-drill,angle-grinder,chainsaw,cement-50kg}.jpg` (all on disk); keep rotate/rounded-3xl/shadow-pop, keep `aria-hidden`+`alt=""`; add `priority` to the two top-row images (kills lazy → LCP fix).
2. **Hero.tsx:59** add `isolate` to the `.relative` wrapper (or drop `-z-10`) so the cta-600 glow actually paints.
3. **Hero.tsx:57** `hidden lg:block` → `hidden sm:block` — show the 2×2 photo collage on mobile (currently a text-only dark rectangle).
4. **Hero.tsx:38-53** add 3 trust chips under CTAs: "Pay on delivery" / "MTN MoMo / Airtel Money" / "Bank transfer" (`rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white`) — mirrors checkout copy, no new data.
5. **CategoriesShowcase.tsx:34-51** render only `productCount > 0` categories, COUNT DESC (fallback to all + "on the way" copy when none); add per-tile slug→icon mapping (ui icon set, fallback IconBox) in `size-11 rounded-lg bg-brand-100 text-brand-800` — kills the empty-chips grid.
6. **TrustSignals.tsx** delete "No payment upfront" card (3-of-4 same story + duplicates banner); replace with a breadth/selection signal; remove the flat-fee sentence from card 1 (banner stays THE fee disclosure).
7. **Section kickers** — above each h2 add `text-xs font-semibold uppercase tracking-wider text-cta-600` ("Our picks" / "The catalog" / "Why Zubeli"); hero already has an eyebrow — mirroring it makes the page feel designed.
8. **Hero.tsx:30-33** typography: h1 → `text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight`; subtitle → `sm:text-lg lg:text-xl` (oversized display = premium signal).
9. **New CTA band** (homepage scope, after TrustSignals): `bg-ink-dark` centered: kicker + h2 "Ready to start your build?" + p "Order online and pay when your tools arrive — across Rwanda." + one primary `Button lg` "Browse all tools" + `focus-visible:outline-brand-400` — ends the page on action.
10. **FeaturedProducts.tsx:41** when `products.length < 4` → `sm:grid-cols-2 lg:grid-cols-2 lg:max-w-3xl` (large intentional cards); keep `lg:grid-cols-4` at ≥4.

## Notes
- All items are homepage-agent's own files; zero foundation/backend edits. Items 5-6,10 are demo-critical (page currently advertises emptiness with ~4 live products).
- Keep a11y: collage stays `aria-hidden`+`alt=""`, single h1, real h2 in new band, brand-400 focus rings on dark band (existing hero pattern).
- Not in scope: tabular-nums ✓, reduced-motion ✓, focus states ✓ already good.
