# UI/UX Review — Pro-Max Skill Audit of Storefront + Dashboard

*2026-08-08 — uiux-reviewer (READ-ONLY; no files edited)*

## Verdict

**No P0 (blocking) findings.** The app is functionally green (e2e 29/29) and already
scores unusually high on the skill's CRITICAL categories (a11y, touch, interaction).
This audit is a **professional-polish pass**: 1 P1 visual-trust item, ~8 P1/P2
conversion & readability items, rest P2 polish. Severity scale below maps to the
quality gate's CRITICAL/HIGH/MEDIUM/LOW for hand-off.

| This audit | Gate equivalent |
|---|---|
| P0 | CRITICAL |
| P1 | HIGH (hurts conversion/trust/professional perception) |
| P2 | MEDIUM/LOW (polish) |

## Skills mastered (STEP 1)

Read in full: `ui-ux-pro-max/SKILL.md` (10-category priority table), `references/quick-reference.md`
(98 guidelines), `references/pro-rules.md` (pre-delivery checklist), `ui-styling/SKILL.md` +
`tailwind-customization|responsive|utilities|shadcn-theming|shadcn-accessibility.md`,
`design-system/SKILL.md` + `token-architecture|semantic-tokens|states-and-variants|component-specs.md`,
`brand/SKILL.md` + `color-palette-management|typography-specifications|visual-identity|consistency-checklist.md`,
`design/SKILL.md` (skim). CSVs skimmed: styles, colors, typography, ux-guidelines, products,
landing, app-interface, charts, ui-reasoning, stacks/nextjs.

## Design intelligence (STEP 2)

`search.py "construction tools ecommerce professional trustworthy" --design-system -p "Zubeli"`:

- **Style: Minimalism & Swiss** (flat, high-contrast, grid-based, sans-serif) — matches current build.
- **Colors: industrial grey + safety orange** — Primary #64748B / Accent **#EA580C** ("adjusted from #F97316 for WCAG 3:1") / BG #F8FAFC / FG #334155.
- **Typography: EB Garamond + Lato** — *rejected for this product* (legal/formal pairing; a construction-tools storefront needs a grotesque). "Modern Professional" (Poppins/Open Sans) or the existing Geist stack fits Swiss minimalism better. Keep Geist.
- Deep-dives: `--domain product "ecommerce"` (Feature-Rich Showcase + Sales Intelligence Dashboard — matches), `--domain chart "dashboard kpi"` (bullet charts, values always visible as text), `--domain style "industrial minimal"`, `--domain typography "professional modern sans"`, `--domain landing`, `--stack nextjs` (next/image, priority on LCP, loading.tsx, OG images).

## Evidence (STEP 3/5)

- **Read:** tailwind.config.ts, globals.css, src/lib/format.ts, all 20 `components/ui/*`, all 9 `components/storefront/*`, all 14 `components/admin/*`, homepage + catalog + product detail + cart + checkout (all components) + login/register + account + all 5 admin screens (~45 files).
- **Live curl (:3001):** `/` 200, `/products` 200, `/cart` 200, `/login` 200, `/admin` 307→`/login?next=%2Fadmin` (guard works). Homepage HTML confirms hero h1 `text-3xl→lg:text-5xl`, ink gradient, no hero imagery.
- **Scans:** zero raw hex in TSX components (token discipline holds), zero emoji-as-icon, `text-[11px]` ×3, no `cursor-pointer` base rule, inputs ≈42px tall.

---

## Gap analysis — every finding tagged `[skill]` with rule source

### P1 (HIGH — hurts trust / professional perception / demo impact)

1. **CTA hue drifts from the recommended safety orange** — `tailwind.config.ts:13-24` (brand = amber #f59e0b…#78350f), `Button.tsx:10` (primary `bg-brand-700` #b45309 — dark amber-brown, reads "mustard brown"), `Hero.tsx:30-37` (primary CTA is dark-on-dark against ink: 3.85:1, visually recedes). The design-system recommendation is accent **#EA580C** (safety orange). **Why it matters:** the single most visible brand signal on the demo face is a brown button instead of construction-site orange. `[style#color-palette-from-product]`, `[ux#contrast-4.5:1]`, `[style#primary-action]`.
2. **Half-dark-mode hybrid** — `globals.css:10-15` flips `--background` to #0c0a09 under `prefers-color-scheme: dark`, but every component hardcodes light surfaces (`bg-white` cards, `bg-stone-50` footer/admin). On a dark-mode laptop (common at demos) the overscroll/rubber-band exposes a near-black body behind white chrome — looks broken. `[style#dark-mode-pairing]`. Fix: **delete the override (light-only, deliberate)** or ship a full dark theme later.
3. **Dashboard KPI accuracy (M1/M2 backlog, already tracked)** — stock KPIs computed from `listStockAdminAction(limit:100)` and customers KPIs from loaded rows only. Wrong numbers in a KPI card destroy dashboard trust. `[chart#large-dataset]`, `[chart#data-density]`. Carried from dashboard gate; **escalates to HIGH if still open at hosting** (matches AGENTS.md). No action needed now beyond scheduling.
4. **Hero has no product visual** — `Hero.tsx:12-48` is a text block on a gradient. The landing pattern for e-commerce is "Hero + Features + CTA" with imagery; 12 branded product SVGs already exist in `public/images/products/`. A desktop-only SVG collage would transform perceived quality at the demo. `[landing#hero-features-cta]`, `[product#e-commerce]`.

### P2 (MEDIUM — polish / readability)

5. **Money figures don't use tabular numerals** — `Price.tsx:6-11` and `StatCard.tsx:54` (`truncate text-2xl font-bold`) lack `tabular-nums`, so cart totals and KPI values jitter as digits change. `[typography#number-tabular]`.
6. **Revenue chart: trend data in bars, values hover-only** — `MonthlyRevenueChart.tsx:28-61`: monthly revenue is a time series → charts.csv recommends a line; 12 points is a small dataset → direct labeling. Values only in `title` (hover) + sr-only. `[chart#chart-type]`, `[chart#direct-labeling]`, `[chart#time-scale-clarity]` (visible labels are month-only, no year).
7. **No `cursor-pointer` on buttons** — `Button.tsx:43-44` base classes lack it and there is no base-layer rule; every `<button>` renders the arrow cursor (Tailwind v3 preflight doesn't add pointer). Pro-rules checklist item. `[ux#cursor-pointer]`, `[pro-rules#visual-quality]`.
8. **Inputs ≈42px, under the 44px touch floor** — `Input.tsx:10`, `Select.tsx:19` (`py-2.5` + `text-sm`). On mobile checkout (the money flow) this is the most-tapped control type. `[ux#touch-friendly-input]`, `[ux#touch-target-size]`.
9. **SearchBox submit button 32×32** — `SearchBox.tsx:36-42` (`h-8 w-8`). `[ux#touch-target-size]`.
10. **Type floor violation: `text-[11px]` ×3** — `CartBadge.tsx:25`, `MonthlyRevenueChart.tsx:56`, `ProductForm.tsx:487`. Caption floor is 12px. `[typography#readable-font-size]`.
11. **NavBar has no active-location state** — `NavBar.tsx:10-25`; no `aria-current` or visual indicator on Home/Products (FilterSidebar and Gallery do it correctly — inconsistency). `[ux#nav-state-active]`.
12. **Reduced-motion only covers `animate-*` classes** — `globals.css:37-44`; the ProductCard image zoom (`ProductCard.tsx:52` `group-hover:scale-105`) and all `transition-colors` still animate. Standard fix: global transition kill under the media query (shadcn-accessibility pattern). `[ux#reduced-motion]`.
13. **Checkout: order summary renders below the form on mobile** — `CheckoutFlow.tsx:202-236` (aside after main). Core e-commerce pattern: summary first (or collapsible) on small screens. `[ux#content-priority]`.
14. **No password show/hide toggle** — `LoginForm.tsx:80-86`, `RegisterForm.tsx:95`. `[ux#password-toggle]`.
15. **Login/register have no client pre-check** — `LoginForm.tsx:57` (`noValidate`, server round-trip only) while checkout has a mirror pre-check (`CheckoutFlow.tsx:37-70`) — inconsistent feedback speed across the same app. `[ux#inline-validation]`.
16. **Admin DataTable has no column sorting** — `DataTable.tsx:73-198` (no `aria-sort`, no sort control). Expected in business tables (orders by date/total). `[chart#sortable-table]`.
17. **No delivery-time expectation anywhere** — `TrustSignals.tsx:13-34`, checkout panels: flat fee is disclosed (no hidden costs ✓) but "delivery in ~X" reassures conversion. `[landing#conversion]`. (Do not invent claims — only add if the owner can commit to a range.)
18. **Admin success feedback via Alert only, no toast in shell** — known gap G1 (stock screen mounts its own ToastProvider; others don't). `[ux#success-feedback]`. Already tracked.
19. **Ad-hoc z-index `z-[70]`** — `Toast.tsx:77` outside the defined scale (0/10/20/40/100…). `[ux#z-index-management]`. Cosmetic.
20. **Stroke-width drift** — `ProductForm.tsx:44` inline UploadIcon uses `strokeWidth={1.8}` vs the set's 2/2.2. `[pro-rules#stroke-consistency]`. Cosmetic.

---

## Top 15 prioritized improvements (storefront first)

**S = structural (new logic/component/endpoint), Q = quick win (restyle-only).**

1. **[Q/P1] Safety-orange CTA token** — `tailwind.config.ts` + `Button.tsx:10`.
   Rule: `style#color-palette-from-product`, `ux#contrast-4.5:1`.
   Add `cta` scale (orange family) alongside brand; keep amber for chips/links/rings:
   ```ts
   cta: { 50:"#fff7ed", 100:"#ffedd5", 600:"#ea580c", 700:"#c2410c", 800:"#9a3412" }
   ```
   `Button.tsx` primary: `bg-cta-600 text-ink-dark hover:bg-cta-700 active:bg-cta-800` — ink-on-orange is **5.4:1** (AA) and reads industrial; white-on-cta-700 is 4.6:1 as the alternative. Hero CTA pops at **6.1:1** on ink-dark. (White on cta-600 alone is 3.1:1 — do not use.)
2. **[Q/P1] Kill the half-dark-mode** — `globals.css:10-15`: delete the `prefers-color-scheme` block (light-only, matches current components) or file a full-dark theme as future work.
3. **[Q/P1] Hero product collage** — `Hero.tsx`: add a `hidden lg:grid grid-cols-2 gap-4` of 2–4 existing product SVGs (e.g. angle grinder, drill, helmet) in branded chips, right of the copy; `aria-hidden` decorative; keeps h1 as the anchor. Rule: `landing#hero-features-cta`.
4. **[S/P2] Revenue chart v2** — `MonthlyRevenueChart.tsx`: keep CSS bars (no deps) but add direct value labels (`text-xs tabular-nums text-stone-600`) above each bar ≥sm, year-aware labels ("Aug '25"), and month-only `sr-only` unchanged. Structural alternative (future): SVG line via `charts.csv` guidance. Rule: `chart#direct-labeling`, `chart#time-scale-clarity`, `chart#chart-type`.
5. **[Q/P2] Tabular figures for all money** — `Price.tsx` sizeClasses + `StatCard.tsx:54` + cart/checkout totals: add `tabular-nums`. Rule: `typography#number-tabular`.
6. **[Q/P2] cursor-pointer discipline** — `globals.css @layer base`: `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }`. Rule: `ux#cursor-pointer`, pro-rules checklist.
7. **[Q/P2] 44px input floor** — `Input.tsx`/`Select.tsx`: `min-h-11` (keep `py-2.5` for textarea only). Rule: `ux#touch-friendly-input`.
8. **[Q/P2] SearchBox submit 44px** — `SearchBox.tsx:39`: `h-8 w-8` → `size-11` (right-0.5). Rule: `ux#touch-target-size`.
9. **[Q/P2] NavBar active state** — small client `ActiveNavLink` (usePathname, like CategoryDropdown pattern) rendering `aria-current="page"` + `text-brand-700 bg-brand-50` for the current route. Rule: `ux#nav-state-active`.
10. **[Q/P2] Global reduced-motion kill** — `globals.css`: extend the existing media query to zero transitions/durations on all elements (shadcn-accessibility canonical snippet). Rule: `ux#reduced-motion`.
11. **[Q/P2] Type floor** — `CartBadge.tsx:25`, `MonthlyRevenueChart.tsx:56`, `ProductForm.tsx:487`: `text-[11px]` → `text-xs`. Rule: `typography#readable-font-size`.
12. **[Q/P2] Checkout mobile order** — `CheckoutFlow.tsx:202`: on `<lg` render OrderSummaryPanel above the form (order-first swap; `lg:` classes only). Rule: `ux#content-priority`.
13. **[S/P2] Password toggle + pre-check parity** — foundation `PasswordInput` (Input + toggle button, `aria-pressed`, autocomplete preserved) used by login/register; port `validateForm`-style pre-check into LoginForm. Rule: `ux#password-toggle`, `ux#inline-validation`.
14. **[S/P2] DataTable sorting** — add `sort` state + client-side sort on loaded rows (datasets are small in MVP) with `aria-sort` on `<th>`; backend sort params later. Rule: `chart#sortable-table`.
15. **[S/P2] Delivery-ETA copy + admin toast parity** — (a) one line in TrustSignals/checkout ("Delivery in ~1–2 business days in Kigali") only with owner sign-off; (b) mount ToastProvider in the admin shell (gap G1) so product/stock/order mutations toast like the storefront. Rules: `landing#conversion`, `ux#success-feedback`.

## Quick wins vs structural

- **Quick wins (restyle-only, zero new deps):** #1, #2, #3, #5, #6, #7, #8, #9, #10, #11, #12. ~11 of 15 are class/token swaps — one foundation pass by frontend-agent + touch-ups by screen agents (per SCREENS.md ownership; foundations owned by frontend-agent, charts by sales-agent, checkout by checkout-agent).
- **Structural (flagged):** #4 (chart logic), #13 (new foundation component), #14 (sort state), #15b (admin shell provider — dashboard-agent), #15a (copy — content-writer sign-off). All still dependency-free.

## Keep list — already conforms

- **Token discipline:** zero raw hex in components; single brand/ink/danger/success scale; semantic `--background`/`--foreground`. `[design-system#semantic-tokens]`
- **Palette direction:** ink charcoal + amber is a near-match for "industrial grey + safety orange" — only the CTA hue needs the shift (#1). `[style#color-palette-from-product]`
- **Swiss-minimal base:** flat surfaces, `shadow-card` scale (2 steps), radius sm→xl, 8pt spacing, consistent `max-w-7xl`. `[style#effects-match-style]`, `[ux#spacing-scale]`, `[ux#container-width]`
- **States:** Button loading/disabled/aria-busy, global `:focus-visible` ring with hero-scoped brand-400 (documented 5.02:1 rationale), disabled opacity+pointer-events. `[states-and-variants]`, `[ux#focus-states]`
- **Touch:** Button md=44/lg=48, QuantityStepper 44px buttons, header actions 44px, gallery thumbs 64–80px. `[ux#touch-target-size]`
- **Dialog a11y:** focus trap, Esc, overlay dismiss, aria-modal, scroll lock, focus restore. `[shadcn-accessibility#dialog]`
- **Empty states everywhere with next action** (catalog, cart, dashboard chart "No revenue yet", admin tables). `[ux#empty-states]`
- **Skeletons over spinners**, grid-matched route `loading.tsx`; aspect-square image slots (CLS-safe). `[ux#progressive-loading]`, `[nextjs#loading-states]`
- **Error handling:** per-field + page-level Alerts with retry; toasts `aria-live="polite"`, auto-dismiss 5s. `[ux#error-placement]`, `[ux#toast-dismiss]`, `[ux#toast-accessibility]`
- **Checkout:** progressive disclosure (bank ref only when selected), persistent helper text, `inputMode`/`autocomplete` semantics, required indicators, server-authoritative validation. `[ux#progressive-disclosure]`, `[ux#input-helper-text]`, `[ux#input-type-keyboard]`, `[ux#autofill-support]`
- **No dead ends:** unknown order → home redirect; guest customers unlinked; footer placeholders instead of dead links. `[ux#error-recovery]`, `[ux#empty-nav-state]`
- **Product page:** breadcrumb, JSON-LD (escaped), sticky buy box, stock status + out-of-stock recovery link, sr-only image counter, swipe threshold 40px + keyboard thumbs. `[ux#breadcrumb-web]`, `[ux#gesture-alternative]`
- **Charts a11y:** sr-only values for every bar; empty + error states with retry. `[chart#screen-reader-summary]`, `[chart#empty-data-state]`, `[chart#error-state-chart]`
- **Typography decision:** keeping Geist (grotesque) over the search's EB Garamond/Lato pairing — deliberate, per skill's own "match pairing to product" rule. `[typography#font-pairing]`

## Follow-up

- Frontend foundation pass (items #1–#2, #5–#8, #10–#11) is one `frontend-agent` dispatch; screen-agent touch-ups then follow SCREENS.md ownership. No backend changes required except the already-tracked M1 (lowStock KPI endpoint) for KPI accuracy.
- Report index entry to docs-writer; findings feed the quality gate as a polish backlog (no gate re-run required — zero P0/P1-blocks-launch).
