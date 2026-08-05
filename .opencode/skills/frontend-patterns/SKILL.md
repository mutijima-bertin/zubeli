---
name: frontend-patterns
description: "Use when building storefront or dashboard UI in zubeli. Covers server vs client components, data fetching, forms, state management, Tailwind styling, and next/image usage."
---

# Frontend Patterns

Next.js App Router + TypeScript + Tailwind conventions for the zubeli storefront and admin dashboard.

## When to use
- Creating or editing any page, component, form, or hook in `src/app` or `src/components`.

## Core rules
- **Server components by default.** Add `"use client"` only for interactivity: `onClick`, `useState`, `useEffect`, event handlers, form state.
- Rule of thumb: fetching + rendering = server; buttons, inputs, drawers, toasts = client. Push the client boundary down; wrap interactive pieces in small client components with props.
- Data fetching in server components:
  ```tsx
  // server component
  const products = await getFeaturedProducts(); // repository call, no "use client"
  ```
  - Use SWR or React Query for client-side data (cart badge, admin tables with live updates). One choice across the app — do not mix.
  - Cache and revalidate: `revalidatePath` / `revalidateTag` after mutations.
- Forms: `useActionState` + server actions for mutations; client-side validation mirror of the zod schema; disable submit while pending; show field errors from the `ActionResult<T>` error shape.
- Loading states: `Suspense` boundaries around server-fetched sections (skeletons, not spinners); `useTransition` for client navigation feel.
- State: `useState` for local UI; React Context for auth/cart session; no global state library unless complexity demands it.
- Styling: Tailwind only. Utility classes inline; extract repeated patterns to small components (Button, Input, Card) in `src/components/ui`. Follow the design tokens in docs/SCREENS.md.
- Images: always `next/image` with `sizes`; use `fill` inside fixed-ratio containers; provide `width`/`height` or `fill` — never bare `<img>`.
- Client components: keep props serializable; no functions or dates passed from server to client without serialization.
- Accessibility: semantic HTML, labels on inputs, focus states, `aria` attributes on icon buttons.
- Validate layout at common viewport widths (mobile-first storefront; dashboard min-width) before marking UI done.

## Do NOT
- Do NOT fetch data with `useEffect` when a server component or SWR/React Query can do it.
- Do NOT make a component client-only to avoid a server error — fix the error.
- Do NOT use `<img>` directly; use `next/image`.
- Do NOT put secrets or DB access in client components or client-side code.
- Do NOT add new CSS-in-JS or global CSS files — Tailwind only.

## Related
- backend-patterns (server actions + zod), api-design (client API usage), tdd-workflow (component tests), agents: frontend-agent, uiux-reviewer, homepage-agent, product-page-agent, cart-agent.
