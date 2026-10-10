# Homepage Landing Redesign — 10 Audit Items

*2026-08-09 — homepage-agent (storefront landing, `/` only)*

## Items done (uiux-reviewer audit, all 10, own files only)

1. **Collage → real photos**: SVGs → `/images/products/stock/{power-drill,angle-grinder,chainsaw,cement-50kg}.jpg` (verified on disk; mixed ratios → `fill` + `object-cover` in `aspect-[4/3]` tiles). Top row `priority`, bottom row `loading="lazy"`; `alt=""` + `aria-hidden` kept.
2. **Glow**: collage wrapper `relative isolate` — the `-z-10 bg-cta-600/15 blur-3xl` glow now paints behind tiles (was dead).
3. **Breakpoint** — `hidden lg:block` → `hidden sm:block` (collage from sm up, no text-only tablets; `<640px` stays text-first).
4. **Payment chips** — 3 pills under CTAs (audit classes verbatim): Pay on delivery / MTN MoMo / Airtel Money / Bank transfer (checkout copy mirror, no new data).
5. **CategoriesShowcase** — filter `productCount > 0`, count-desc (+name tiebreak); slug→icon map w/ fallback IconBox in `size-11 rounded-lg bg-brand-100 text-brand-800`; dynamic columns: ≤2 → `grid-cols-1 sm:grid-cols-2` LARGE tiles, 3–4 → `sm:grid-cols-2 lg:grid-cols-4`, else 2/3/5; fallback (zero non-empty): all + "on the way" note.
6. **TrustSignals** — 4→3 cards: kept Delivery across Rwanda / Tools for every job / ONE Pay-on-delivery card; dropped "No payment upfront" + the flat-fee card (banner stays THE fee disclosure); `deliveryFeeCents` prop removed (page.tsx updated).
7. **Kickers** — `text-xs font-semibold uppercase tracking-wider text-cta-600` above every h2: "Our picks" / "The catalog" / "Why Zubeli" + "Ready when you are" on the new band.
8. **Hero type** — h1 `text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight`; subtitle `sm:text-lg lg:text-xl`.
9. **ClosingCta.tsx (NEW)** — `bg-ink-dark` centered: kicker + real h2 "Ready to start your build?" + "Order online and pay when your tools arrive — across Rwanda." + one primary lg Button "Browse all tools" (`focus-visible:outline-brand-400`, ink-on-cta-600 5.4:1) + microcopy line (pay-on-delivery methods).
10. **FeaturedProducts** — `products.length < 4` → `sm:grid-cols-2 lg:max-w-3xl mx-auto` (2-col LARGE cards); ≥4 → `lg:grid-cols-4`; empty state untouched.

## Files
`src/app/(store)/page.tsx`, `_components/{Hero,FeaturedProducts,CategoriesShowcase,TrustSignals}.tsx`, NEW `_components/ClosingCta.tsx`. DeliveryBanner untouched. productCard consumed only. No backend/foundation edits.

## Verification evidence
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors (only the 2 known e2e warnings)
- Read-only smoke (tmux dev server :3000, no restart): `/` 200; real HTML shows h1 scale + leading, 4 stock jpgs (top row no loading attr = priority, bottom lazy, alt=""), `relative isolate mt-14 hidden sm:block` wrapper, glow class present, 3 chips w/ audit classes, all 4 kickers, 3 trust cards ("No payment upfront" 0 hits), ink-dark closing band, 2 category icon tiles (`power-tools: 3`, `construction-materials: 1`); single `<h1>`; hero `#categories` anchor intact. Dev DB psql read (docker) confirms exactly those 2 categories non-empty (power-tools=3 incl. leftover hedge-shears/slug=zubeli product, construction-materials=1, all others 0) — demo-critical <4/small-count paths are live-verified.

## What the user sees (breakpoints)
- `<640px`: eyebrow + display h1 + CTAs + chips, no collage; 1-col sections; order Hero → fee banner → Featured → Categories → Trust → closing CTA.
- `640–1023px`: collage 2×2 w/ glow; featured 2-col; ≤2 categories → 2 large icon tiles.
- `≥1024px`: 2-col hero (text | collage); featured 4-col; 5-col categories; 3-col trust; full-width ink closing band.
- Demo today (4 active products): 2 large category tiles (power-tools 3, construction-materials 1), 4 featured cards.

## Review focus
- Categories grid-length branching (`≤3/4/≥5`) + zero-count fallback copy; `cat` param preserved.
- Hero tile rotation moved to wrapper divs (required for `fill` images); `sizes` attr; `priority` props.
- ClosingCta: single CTA, real h2 + `aria-labelledby`, brand-400 ring on ink band.
- Kicker contrast: cta-600 on light = 4.28:1 (uppercase 12px semibold — AA large-text; same token the audit prescribed); cta-600 on ink=~5.1:1. Chips are non-interactive text (no focus rings needed). A11y: one h1, aria-hidden collage, keyword `alt=""`.

## Next steps
- Runner checkpoint (full e2e/build) after this wave; homepage e2e PO (HomePage.ts) contract unchanged (hero h1 text + featured h3 names + RWF price intact).