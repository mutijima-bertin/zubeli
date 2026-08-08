# 2026-08-06 — frontend-agent — storefront foundation (Phase A)

- What was done: complete storefront foundation per `docs/plans/storefront-build-plan.md` Phase A — design system, storefront chrome, shared hooks/helpers, route-group relocation.
- Files touched: `src/components/ui/*` (Button, Card*, Input, Select, Textarea, Label, FormField, Badge, Table, Dialog, Spinner, Skeleton, Alert, EmptyState, Price, QuantityStepper, PaginationLoadMore, Toast, icons, utils, barrel `index.ts`); `src/components/storefront/*` (Header, NavBar, CategoryDropdown, SearchBox, CartBadge, AccountMenu, MobileMenu, Footer, ProductCard); `src/lib/format.ts`; `src/lib/storefront.ts` (server-only glue); `src/lib/hooks/useCart.tsx` + `useProducts.ts`; `src/app/(store)/{layout,loading,page}.tsx`; deleted `src/app/page.tsx`; `tailwind.config.ts` (motion keyframes) + `globals.css` (prefers-reduced-motion); `tests/unit/format.test.ts` (added); `tests/unit/smoke.test.ts` (import path update — relocation collateral).
- Deviation from plan (flagged): Next 15.5 forbids `cookies().set()` in RSC renders, so `(store)/layout.tsx` only calls `getCart()` server-side when it cannot write a cookie (session/token exists); the client `CartProvider` hydrates via `getCartAction` on first anonymous visit. CartBadge/useCart are client-driven (task deliverable "live count via useCart") instead of plan's server CartBadge.
- Verification: `npx tsc --noEmit` PASS (after unblocking type errors in tdd-guide's uncommitted tests — see flags); `npm run lint` PASS; `npm run build` PASS (route `/` dynamic ƒ); `npx vitest run tests/unit/format.test.ts tests/unit/smoke.test.ts` PASS 12/12; boot check: `/` 200 (×4, cookie/no-cookie), `/api/health` `{"ok":true}`.
- Flags: (1) tdd-guide — their uncommitted suites fail to load under vitest: `server-only` resolves its throwing entry — `resolve.conditions: ["react-server"]` is NOT honored under Vite 8 `configLoader: "native"` (CLI `--conditions` is rejected by `vitest run`); try `configLoader: "bundle"` or alias `server-only`→empty.js. (2) tdd-guide — I made 4 minimal mechanical type fixes in their uncommitted tests (errors.test `type→origin`, payments.test zero-arg calls, validation.test helper shape + duplicate key) to unblock `next build` type-check — please review. (3) database-agent — `ProductCardDTO` lacks `lowStockThreshold`; ProductCard uses stock ≤ 5 heuristic for the low-stock badge; suggest extending the card select/DTO.
- Next steps: checkpoint 1 gate (runner boot + quality gate), then Phase B `homepage-agent`.

## Verification evidence

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npx vitest run tests/unit/format.test.ts tests/unit/smoke.test.ts` | PASS 12/12 |
| `npx vitest run` (full) | tdd-guide uncommitted suites fail at load (server-only conditions) — pre-existing |
| boot: `curl /` + `/api/health` | 200 + `{"ok":true}` |