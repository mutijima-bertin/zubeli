---
name: accessibility
description: "Use when building or reviewing UI for accessibility: semantic HTML, keyboard navigation and focus management, ARIA, color contrast, form labels and error announcements, alt text, and screen-reader behavior. Target WCAG 2.2 AA."
---

# Accessibility

## When to use
Use when creating any storefront or dashboard component (forms, product
cards, tables, modals, nav, toasts) or reviewing a screen against WCAG 2.2 AA.
Accessibility is a build-in requirement for zubeli, not a polish step.

## Core rules
- Semantic HTML first: `<button>` for actions, `<a href>` for navigation,
  `<nav>`, `<main>`, `<h1>`-`<h6>` in order, `<table>` for tabular data.
- Keyboard: every interactive element focusable and operable — Tab order
  matches visual order; Enter/Space activate buttons; modals trap focus and
  return focus on close; escape closes dialogs.
- ARIA only when HTML semantics fall short (`role="dialog"`,
  `aria-labelledby`, `aria-describedby`, `aria-live` for async updates).
  Do not add redundant ARIA on native elements.
- Color contrast >= 4.5:1 for body text, >= 3:1 for large text/UI components
  (check with axe/Deque contrast tool). Never convey meaning by color alone.
- Forms: every input has a visible `<label>`; required/format errors use
  `aria-invalid` + `aria-describedby`; announce errors via `role="alert"`
  or `aria-live="assertive"`; success messages via `aria-live="polite"`.
- Images: `alt` describes the function/content; empty `alt=""` for decorative;
  icons have `aria-hidden="true"` + text label or `aria-label` on the button.
- Focus visible at all times (never `outline: none` without a replacement).
- Respect `prefers-reduced-motion`; keep target size >= 24x24px.
- Verify with axe DevTools, then a real screen reader (NVDA/VoiceOver) on
  key flows: catalog browse, add-to-cart, checkout, dashboard tables.

## Component checklist
- Product card: heading + link, price announced with currency, sold-out state
  not color-only (`aria-disabled` on the button).
- Table: `th scope`, `<caption>` or `aria-label`, sortable headers are buttons.
- Cart/checkout: step indicators announced, live stock errors inline.

## Do NOT
- Do not wrap divs in click handlers when a `<button>` or `<a>` exists.
- Do not use `aria-label` on elements that already have visible text labels.
- Do not rely on mouse-hover-only interactions (tooltips, dropdowns).

## Related
`ui-design-principles` (visual states), `content-writing` (clear labels).
