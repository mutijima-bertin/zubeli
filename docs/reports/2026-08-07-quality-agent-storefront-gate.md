# Quality Gate — Milestone 3: Complete Storefront (Phase C buying flow)

*Date: 2026-08-07 · Agent: quality-agent · Verdict: **PASS-WITH-BACKLOG** (no CRITICAL/HIGH open)*

## Scope

Full storefront buying flow (Phase C, Milestone 3), already verified end-to-end by `runner` Checkpoint 3 (build PASS, route smoke 200s, prod shape). This gate re-ran the static gates + full suite and ran the reviewer suite over the Phase C surface:

- 5 route groups + their `_components`: `/products` (catalog), `/products/[slug]` (product detail), `/cart`, `/checkout` + `/checkout/success`, `/account` (+ `/login`, `/register`, `/account/orders`, `/account/orders/[id]`)
- `src/actions/{cart,checkout,account}.ts`, `src/lib/hooks/{useCart,useProducts}.{tsx,ts}`
- Storefront server lib consumed by screens (`src/lib/storefront.ts`, `src/lib/format.ts`) and the middleware login redirect path (`src/middleware.ts`)

Reviewer suite (photographer model, one lens per child, read-only, reports to quality-agent): `code-reviewer`, `security-reviewer`, `frontend-reviewer`, `backend-reviewer`, `database-reviewer`, `uiux-reviewer`, `accessibility-auditor`, `performance-optimizer`.

## Evidence (baseline — all green)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 problems |
| Unit + integration | `npx vitest run` | 264/264 passed (15 files, 26.1s) |
| Build + prod shape | (runner, Checkpoint 3, verified pre-gate) | build PASS, 13 routes, prod start healthy |
| Route smoke | (runner, Checkpoint 3) | all 200; admin/account auth redirects 307 |

## Findings (aggregated, severity-tagged)

| # | Sev | Reviewer domain | Finding | Location | Owner | Disposition |
|---|---|---|---|---|---|---|
| F1 | **MEDIUM** | accessibility | Category-count chips `text-stone-400` (12px ⇒ contrast ≈ 2.44:1) fail WCAG 2.2 AA **1.4.3** (needs ≥ 4.5:1). Supplementary-but-informative text (how many products per category). Fix: `text-stone-400` → `text-stone-500` (≈4.6:1) in both desktop and mobile drawer (same `CategoryNav`). | `products/_components/FilterSidebar.tsx:125` | catalog-agent | **Dispatch-queued fix** (queued below; gate not blocked — supplementary text, AA-adjacent, no purchase-path impact) |
| F2 | MEDIUM | Security | `sanitizeNextPath` allows the auth routes themselves as `?next` → a signed-in user hitting `/login?next=/login` (or `/register`) enters a client-side redirect loop (`ERR_TOO_MANY_REDIRECTS`). Fix: also fall back to `/account` when `next` starts with `/login` or `/register`. | `login/page.tsx:19-24` | account-agent | **Dispatch-queued fix** |
| F3 | MEDIUM | Security (defense-in-depth) | Product JSON-LD rendered via `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}` — an admin-entered product name/description containing `</script>` would terminate the block (stored-XSS on the storefront once the dashboard lands; demo seeds are trusted today). Fix: escape `<` → `\u003c` when serializing (or render via a script-safe helper). | `products/[slug]/page.tsx:164-167` | product-page-agent | **Dispatch-queued fix** |
| L1 | LOW | Performance | `/products/[slug]` is `force-dynamic` + uncached (`getProductDetail`/`getCatalogPage` hit the DB on every request). Deliberate for live stock, but worth `unstable_cache`/ISR discussion at hosting time. | `products/[slug]/page.tsx:21`, `lib/storefront.ts:52-79` | performance-optimizer | backlog |
| L2 | LOW | Code | `getFieldErrors` defined 4× (`LoginForm`, `RegisterForm`, `ProfileForm` + exported in `checkout/_components/fields.ts`) — extract one shared client util. | login/register/account forms | frontend-agent | backlog |
| L3 | LOW | Accessibility/UX | `QuantityStepper` aria-label hardcoded (foundation) — repeated "Quantity" labels per cart row lack product context for SR users; auto-id wiring from FormField would fix. | foundation `components/ui` | frontend-agent | backlog (foundation, not gate-blocking) |
| L4 | LOW | UX | `CheckoutFlow`'s page-level error (e.g. OUT_OF_STOCK) stays visible after the user edits fields until the next submit. | `checkout/_components/CheckoutFlow.tsx:112-115` | checkout-agent | backlog |
| L5 | LOW | Frontend | `useCart.refresh()` failure leaves no `error` state → skeleton can stick (self-heals on next action). Carried note from cart-agent. | `lib/hooks/useCart.tsx:74-78` | cart-agent | backlog |
| L6 | LOW | UX/redirect | Middleware sets `next` = pathname only (query dropped) — a query-string `next` (e.g. `/account/orders?a=1`) loses the query after login. No current route depends on it. | `middleware.ts:23-24,35-36` | backend-agent | backlog |
| L7 | LOW | Accessibility | OrderTimeline "upcoming" dot `bg-stone-200 text-stone-400` ≈ 2.0:1 — non-text indicator; state is also conveyed by caption text (AA-ok via text). | `account/orders/[id]/_components/OrderTimeline.tsx:75` | account-agent | backlog |
| L8 | LOW | Performance | ProductGrid page-cache accumulates client-side per `q\|cat\|sort\|cursor` — small bounded growth (20 cards/page), fine at MVP scale. | `products/_components/ProductGrid.tsx:42-80` | — | backlog (watch at scale) |

## Accepted-with-note (carry-forward from foundation gate — re-confirmed unchanged)

XFF spoof (rate-limit), checkout idempotency pre-check outside the transaction (server `createOrder` tx + idempotencyKey=cart id is the backstop), customers-admin unbounded query, payment-provider interface (5-method registry), layout cart-badge create-on-first-visit, guest-cart orphan on register (server cart identity switch; Phase D e2e should exercise registered-user cart path).

## Deliberate behaviors confirmed NOT flagged (per milestone brief)

`/checkout/success` unknown id → redirect `/` (not 404); FormField no `invalid` visual prop (error text + `role=alert` — AA-satisfying); success toast before nav; cart badge client-side hydrate on first guest visit; `getCheckoutOrderAction` public (Decision A, high-entropy cuid).

## What was fixed vs accepted vs backlog

- **Fixed this gate:** none required — no CRITICAL/HIGH findings.
- **MEDIUM F1–F3:** accepted-with-note now, **dispatch-queued** to owning agents (change is 1–2 lines each; exact change specified above). Will be verified at the next gate after fixes land.
- **LOW:** L1–L8 → backlog list carried forward (with carry-forward items inherited from the foundation gate).

## Reviewer suite notes (per-domain assurance)

- backend-reviewer: 4 actions clean — zod-first, `requireUser`/session checks, IDOR check in `getOrderForUser`, cart-authoritative pricing (client values never trusted), rate limit + idempotency on `createOrderAction`, `getCheckoutOrderAction` shape-mirrors `createOrderAction`.
- security-reviewer: guest checkout OK per ADR 0003; sanitizeNextPath open-redirect guards good (only `next`-loop above); no injection in action paths; PII exposure limited to high-entropy known-id order pages; F2/F3 hardening items.
- database-reviewer: no N+1 in screens (one-pass `getCatalogPage`, two-list `getRelated`), cursor pagination correct, DTO mapping safe.
- frontend-reviewer: server/client boundaries clean (`siteConfig` never client-imported), forms controlled + server-authoritative, client validation mirrors schema exactly (min/max boundaries replicate 1:1), state via shared `useCart` w/o duplicate fetches.
- code-reviewer: no dead code on the Phase C surface; duplicates documented (L2); component boundaries consistent w/ SCREENS.md ownership.
- uiux-reviewer: states (skeleton/empty/error/out-of-stock) all handled; sticky buy-box & summary; no dead CTAs; curated empty-state CTAs.
- accessibility-auditor: fieldset+legend radio group, sr-only headings, `role=status` count, focus-visible styling from foundation, never-color-only status (F1, L7 contrast nits).
- performance-optimizer: hero `priority` + correct `sizes`, no client re-fetch loops (accumulation via URL state), small client chunks (F4/L8 notes).

## Next steps

1. `orchestrator` dispatches F1 (catalog-agent), F2 (account-agent), F3 (product-page-agent) — 1–2 line fixes each; reselect on next gate.
2. `runner` Checkpoint 3 already verified; Phase D (e2e specs) proceeds — include guest-cart-after-register path.
3. Re-gate after MEDIUM fixes land (re-run tsc/lint/vitest + spot-check each changed file).

*Report generated by quality-agent; evidence above is from this gate's own runs (tsc/lint/vitest) + runner Checkpoint 3 evidence for build/route smoke.*

---

## RE-GATE (2026-08-07, quality-agent)

- Verdict: **PASS-WITH-BACKLOG** — F1, F2, F3 cleared; CRITICAL/HIGH: 0.
- Baseline re-run: tsc 0, lint 0, vitest 264/264 (15 files, 7.04s) — one chained run; no failures.
- F1 confirmed (FilterSidebar.tsx:125 `text-stone-500` ≈4.6:1 — passes WCAG 1.4.3; single chip render shared by desktop sidebar + mobile drawer).
- F2 confirmed (sanitizeNextPath rejects auth routes incl. trailing-slash/query/hash variants — `/login?next=/register`→`/account`, `/login/`→`/account`, `/products?x=1` passes unchanged, `""`/`null`→`/account`; same-site non-auth paths pass through; `//`, `/\`, `\`, non-`/` starts rejected).
- F3 confirmed (JSON-LD escaped `\u003c`/`\u003e`/`\u0026` at page.tsx:80-83; injected via dangerouslySetInnerHTML at :177; round-trip safe — browser decodes `\uXXXX` before JSON.parse, `</script>` in admin content cannot terminate the block).
- No collateral changes; fixes match the specified remedy exactly. No scope creep observed.
- Carry-forward backlog UNCHANGED: L1-L8 + carry-forwards (XFF spoof, checkout idempotency pre-check outside tx, customers-admin unbounded query, payment-provider iface, layout caching, guest-cart orphan on register).
- Next: Phase D e2e (e2e-runner) — already dispatched in parallel by orchestrator.