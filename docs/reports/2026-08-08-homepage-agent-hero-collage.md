# Homepage Agent — Hero Product Collage (audit #3/#1)

*2026-08-08 — homepage-agent*

## What was done

Built the desktop-only **product collage** for the home hero (ui-ux-pro-max audit P1 #4) and confirmed the safety-orange CTA (P1 #1) is in effect:

- **`src/app/(store)/_components/Hero.tsx`** — hero is now a `lg:grid lg:grid-cols-2 lg:items-center` split: the existing copy/CTA column is byte-identical (h1, eyebrow, paragraph, both CTAs, hrefs, aria — verified against e2e/SEO needs), and a new decorative visual zone appears at `lg+`, hidden on mobile (text + CTA stay first).
- **Collage**: Swiss-grid 2×2 of local seeded branded SVGs — `power-drill`, `circular-saw`, `safety-helmet`, `wheelbarrow` — each `width=800 height=800` via `next/image` (same local-asset pattern ProductCard uses; no remote hostname), subtle `-rotate-2/rotate-2/-rotate-1/rotate-1` tilt + `rounded-3xl shadow-pop` depth, a soft `bg-cta-600/15 blur-3xl` glow behind. Container is `aria-hidden="true"` decorative with `alt=""` images; h1 remains the screen-reader anchor. Static only — no idle animation (respects the global reduced-motion kill).
- **CTA**: `Button` primary already ships `bg-cta-600 text-ink-dark hover:bg-cta-700 active:bg-cta-800` from the foundation pass (never white-on-orange) — Hero consumes it as-is, no variant overrides.

## Verification
- `npx tsc --noEmit` → 0; `npx eslint src/app/(store)/_components/Hero.tsx` → 0.
- Live smoke on :3001 (user dev server, left untouched): `/` 200; all 4 SVGs serve `200 image/svg+xml`; served HTML contains the 4 tilted tiles + glow div, identical h1/CTA labels, and `aria-hidden` collage wrapper.

## Notes for reviewers
- Only `Hero.tsx` touched (own route). No shared components edited, no new deps, no emoji.
- Collage intentionally decorative (products repeat below in FeaturedProducts); tiles truncated to the 4 strongest shapes — ladder/mixer left out to keep the grid tight.
- Next steps: none for this item; leftover audit items #12–#15 belong to checkout/account/dashboard owners.