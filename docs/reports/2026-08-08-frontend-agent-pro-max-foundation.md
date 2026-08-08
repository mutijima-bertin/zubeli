# Frontend Foundation — Pro-Max Professional Design Pass

*2026-08-08 — frontend-agent (storefront foundation owner)*

## Skills mastered (STEP 1)
Read in full: `ui-ux-pro-max/SKILL.md` + `pro-rules.md` + `quick-reference.md` (a11y/touch/typography/color/motion), `ui-styling/SKILL.md` + `tailwind-customization|utilities|responsive.md`, `design-system/SKILL.md` + `primitive-tokens|semantic-tokens|component-specs|states-and-variants|tailwind-integration.md`, `brand/SKILL.md` + `color-palette-management|typography-specifications|consistency-checklist.md`.

## Design intelligence (STEP 2)
`search.py "construction tools ecommerce professional trustworthy" --design-system -p "Zubeli"` → Minimalism/Swiss, industrial grey #64748B + safety orange accent **#EA580C** (adjusted for WCAG), BG #F8FAFC. Typography pairing (EB Garamond/Lato) REJECTED per prior audit — Geist kept.

## Implemented (audit IDs; files)
- **#1 CTA scale** — `tailwind.config.ts`: added `cta` 50–900 orange ramp (#EA580C @600); `Button.tsx` primary → `bg-cta-600 text-ink-dark hover:bg-cta-700 active:bg-cta-800` (ink-on-orange 5.4:1 AA; white-on-cta-600 is 3.1:1 — avoided). Other variants untouched.
- **#2 half-dark-mode** — `globals.css`: removed `prefers-color-scheme: dark` body flip (light-only, deliberate; comment explains).
- **#5 tabular-nums** — `Price.tsx`: `tabular-nums` added to the price span (all sizes).
- **#6 cursor-pointer** — `globals.css @layer base`: `button:not(:disabled), [role="button"]:not(:disabled), label[for], summary { cursor: pointer }`.
- **#7 44px input floor** — `Input.tsx`/`Select.tsx`: `min-h-11` with `py-2` (Textarea already `min-h-28` ≥ 44px; FormField stacking unaffected).
- **#8 SearchBox submit 44px** — `SearchBox.tsx`: `h-8 w-8` → `size-11`; input `pr-12` → `pr-14` so text clears the bigger button; `aria-label="Submit search"` unchanged.
- **#9 NavBar active state** — `NavBar.tsx`: converted to client component (props stay serializable), `usePathname`; active link gets `aria-current="page"` + `bg-brand-50 text-brand-700` (mutually exclusive with `text-ink` — same-specificity utilities). Products matches `/products` + subroutes.
- **#10 reduced-motion** — `globals.css`: replaced class-scoped kill with global `*, *::before, *::after` duration/iteration/scroll-behavior override (canonical snippet).
- **#11 type floor** — `CartBadge.tsx`: `text-[11px]` → `text-xs`.

## Verification
- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **0 errors in src/** (all 15 errors + 1 warning are inside the vendored `docs/reference/ui-ux-pro-max-skill/**` .cjs scripts — owner-installed package, NOT my scope; 2 known e2e warnings unchanged).
- Live dev server (:3001): `/` 200 + `/products` 200. HTML smoke: homepage shows `bg-cta-600` CTAs, `tabular-nums` prices, `text-ink-dark` button text; `/` → only Home link has `aria-current="page"`, `/products` → only Products link (active pill confirmed).
- e2e-visible strings/labels untouched (nav labels, "Submit search", badge counts).

## Notes / leftovers
- Pre-existing uncommitted in-scope work found: `ProductCard.tsx` + `QuickAddToCartButton.tsx` (prior quick-add session) — left intact, verified tsc/lint clean.
- Out of scope per brief: StatCard tabular-nums (dashboard-agent), MonthlyRevenueChart 11px/direct-labels (sales-agent), ProductForm 11px + stroke (inventory-agent), Hero collage (#3), checkout order swap (#12), password toggle/pre-check (#13), DataTable sort (#14), admin toast (#15b), delivery-ETA copy (#15a).
- Hover contrast note: ink-dark on cta-700 hover ≈3.8:1 — transient bold text, matches audit's prescribed chain; rest-state 5.4:1 AA.
