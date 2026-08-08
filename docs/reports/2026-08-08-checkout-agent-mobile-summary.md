# 2026-08-08 — checkout-agent — mobile-summary

**Item #12 (pro-max audit): order summary above the form on mobile.**

- Changed `src/app/(store)/checkout/_components/CheckoutFlow.tsx` only — all labels, radio names, aria attributes, form field names, actions and types untouched; no new deps; no duplicate summary DOM.
- Approach: "first in DOM order" per ui-ux-pro-max skill (mobile-first / content-priority + pro-rules "reading order matches visual order"). The `<aside>` (OrderSummaryPanel) is now the first grid child; on lg+ `lg:order-last` returns it to the 360px right rail with the form left — desktop layout pixel-identical. Sticky (`lg:sticky lg:top-6`) preserved.
- Loading skeleton reordered to mirror the new DOM (summary card first; right rail on lg) so hydration doesn't visually flip blocks.
- e2e-safe: CheckoutPage PO drives via getByLabel / getByRole / input[name][value] — no position/DOM-order assumptions; submit button still last in form flow.
- Verified: `npx tsc --noEmit` → exit 0; `npx eslint "src/app/(store)/checkout/**/*.{ts,tsx}"` → exit 0.
- Live smoke: GET /checkout on :3001 → HTTP 200 (no crash); server payload contains the new `lg:order-last` classes and compiled stylesheet ships the `order-last` utilities.
- Next: visual confirmation in a real browser (viewpoint <1024px shows summary first; ≥1024px unchanged) via e2e/browser session; no further code changes expected.