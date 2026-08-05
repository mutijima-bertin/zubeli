---
name: ui-design-principles
description: "Use when designing or implementing UI for the zubeli storefront and admin dashboard: visual hierarchy, 8pt spacing/typography, component states, mobile-first responsive behavior, touch targets, CTA hierarchy, and dashboard data readability."
---

# UI Design Principles

## When to use
Use when building or reviewing screens: layout, spacing, states, responsive
behavior, or data presentation. Applies to both the customer storefront
(conversion-focused) and the owner dashboard (clarity-focused).

## Core rules
- 8pt grid: spacing, padding, and radii in multiples of 4/8 (`gap-4`, `p-8`);
  keep a type scale of 3-4 sizes with a set ratio (e.g., 14/16/20/28).
- Visual hierarchy: one primary action per view; use size, weight, and
  contrast (not just color) to rank importance; limit font families to two.
- Every interactive element defines all states: default, hover, active,
  focus-visible, disabled, loading, empty, error — no dead ends.
- Loading states: skeletons for lists/cards, spinners for actions; disable
  submit buttons while in flight.
- Empty states: icon + explanation + a clear next action ("No orders yet —
  view your first sale").
- Error states: inline, near the field, with recovery guidance; never a bare
  "Something went wrong".
- Mobile-first: one column layouts on small screens, meaningful breakpoints
  (sm/md/lg), never horizontal scroll; touch targets >= 44x44px (48 ideal).
- Storefront CTA hierarchy: "Add to cart" and "Checkout" are the strongest;
  one CTA per product card; prices and savings clearly emphasized.
- Dashboard readability: tables with sticky headers, zebra rows, right-aligned
  numeric columns; KPIs as labeled stat cards with trend indicators; charts
  with axis labels and tooltips; always show empty/zero states for dates.

## Do NOT
- Do not stack 3+ CTAs of equal prominence on one screen.
- Do not rely on hover to reveal primary actions (fails on touch).
- Do not cram dashboards: prefer progressive disclosure (tabs, drill-downs).
- Do not use pure black-on-white text blocks; use muted text for secondary.

## Related
`accessibility` (states/contrast), `performance-patterns` (skeletons vs
spinners), `content-writing` (label and empty-state copy).
