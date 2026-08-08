# Zubeli — Storefront Build Plan (detailed)

- Date: 2026-08-06. Author: planner. Predecessor: `docs/plans/mvp-demo-plan.md` (Phase 3 condensed here into executable steps).
- Demo MVP, RWF, Pay-on-Delivery (COD_CASH / COD_MOBILE_MONEY / BANK_TRANSFER, manual verification). Repo local-only — no push/publish.
- One agent at a time; reviewers run ONLY as children of `quality-agent`. Route ownership per `docs/SCREENS.md`.

## 0. Standing contracts (apply to every step)

- **Path convention**: all storefront routes live under `src/app/(storefront)/` route group (home= `/` as `(storefront)/page.tsx`; cart, checkout, login, register, account, products all inside the group; `/admin/*` and `/api/*` stay at root → Phase E admin shell gets a clean layout, no storefront chrome).
- **Data access**: server components import `src/lib/storefront.ts` (server-only helpers, owned by `frontend-agent`) — never import `src/lib/db/*` directly from a page; never new server actions except the single flagged one in Phase C-4.
- **Data flow**: server fetch → pass serializable props to small client components. Mutations via existing actions + `useActionState`; actions call `revalidateTag('cart:')` / `revalidatePath`; client calls `router.refresh()` after success.
- **Money**: integer cents, `formatRWF(cents)` from `src/lib/format.ts` (client-safe). 1 minor unit = 1 RWF.
- **Errors**: every action returns `ActionResult<T>`; render `error.message` (field errors under `error.details.fieldErrors` — ZodError shape). Never throw across the boundary.
- **Server/client split**: pages/layouts/cards = server; forms/buttons/steppers/load-more/dialog/toast = client. NO new dependencies (no SWR — `useActionState` + refresh is the pattern; `package.json` is a shared file — never touch).
- **Images**: `next/image` only; seed placeholders exist at `public/images/products/*`.
- **Testing**: ALL specs live in `tests/` — owned by `tdd-guide` (and `e2e/` by `e2e-runner`). Screen agents do NOT write test files (they may run `npm test` locally for evidence).
- **NOT to touch (screen agents)**: `src/components/ui/*`, `src/components/storefront/*`, `src/lib/storefront.ts`, `src/lib/format.ts`, `src/lib/hooks/*`, `src/app/(store)/layout.tsx`, all `src/actions/*`, `src/lib/*`, `prisma/*`, `tests/*`, `e2e/*`, config files. Missing component? Request via orchestrator → `frontend-agent`.

---

## Phase A — Foundations (`frontend-agent`)

**Design-system primitives — exhaustive list (screen agents must NEVER need more):**

`components/ui/`: `Button` (variants primary/secondary/ghost/danger, sizes sm/md/lg, `loading` prop, optional `href` → renders anchor), `Card` (+`CardHeader/CardBody/CardFooter`), `Input` (text/email/tel/number, `aria-invalid`, error styling), `Select` (native, styled), `Textarea`, `Label`, `FormField` (label+control+hint+error, auto id), `Badge` (neutral/brand/success/danger/info), `Table` (Container/Head/Body/Row/Cell primitives), `Dialog` (client; focus trap, Esc, aria-modal), `Spinner`, `Skeleton`, `Alert` (info/success/warning/danger, page-level errors + toasts), `EmptyState` (icon+title+description+action), `Price` (cents+currency → formatted; size variants), `QuantityStepper` (client; min 1, max = stock cap, emits onChange), `PaginationLoadMore` (client; cursor pattern, pending state, append), `Toast` (client context + viewport).

` `components/storefront/`: `Header` (server: reads session via `getSession()`, cart via `getCart()`), `NavBar` (links + category menu from `listAll()`), `SearchBox` (client GET form → `/products?q=`), `CartBadge` (server, count = Σ quantities, link `/cart`), `AccountMenu` (client: logged-in name → /account, logout; else Sign in), `MobileMenu` (client, hamburger), `Footer` (server: shop info, COD note, links), `ProductCard` (server, presentational: image, name, category, `Price`, `Badge` featured/low-stock/out, link `/products/{slug}`; optional `quickAdd` slot via prop).

**Shared helpers & hooks:**
- `src/lib/format.ts` (client-safe): `formatRWF(cents, currency='RWF')` (Intl), `formatDate/formatDateTime(iso)`, status→copy+tone maps for OrderStatus/PaymentStatus/PaymentMethod.
- `src/lib/storefront.ts` (server-only): `getHomepageData()` (featured via `getFeatured`, categories via `listAll`), `getCatalogPage({q,cat,sort,cursor})` → mapped `Page<ProductCardDTO>` + `CategoryWithCount[]` + applied filter echo, `getProductDetail(slug)`, `getRelated(product)` (same category, self excluded, padded from featured — repo can't exclude, filter here).
- `src/lib/hooks/useCart.ts` (client): wraps the 4 cart actions (`getCartAction/addToCartAction/updateCartQtyAction/removeCartItemAction`), exposes `{cart, itemCount, add, updateQty, remove, pending, error, refresh}`; forms through `useActionState`/transition + `router.refresh()`.
- `src/lib/hooks/useProducts.ts` (client): `quickAdd(productId, qty)` for ProductCard (calls `useCart.add`, toast on OUT_OF_STOCK), `related` props helper.
- `src/app/(store)/layout.tsx`: storefront chrome (Header/Footer) + `Suspense` boundaries; **relocate** placeholder `src/app/page.tsx` → `src/app/(store)/page.tsx` (mechanical move; real content is Phase B, `homepage-agent`).
- `components/ui/index.ts` barrel export (single import surface).

**Verification (Checkpoint 1):** `npx tsc --noEmit` → `npm run lint` → `npm test` (existing suites stay green) → **runner**: `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`, `curl localhost:3000/api/health` = `{"ok":true}`, homepage 200. → **tdd-guide**: add `tests/unit/storefront/*` (format.ts, useCart reducers, status maps). → **quality-agent** gate (spawns code-reviewer, uiux-reviewer, accessibility-auditor as children; verdict).

## Phase B — Home (`homepage-agent`)

Files: `src/app/(store)/page.tsx` (server) + `src/app/(store)/_components/`: `Hero.tsx` (H1 + value prop + primary CTA → /products), `FeaturedProducts.tsx` (from `getHomepageData().featured`, renders shared ProductCard), `CategoriesShowcase.tsx` (from `listAll` counts → chips linking `/products?cat={slug}`), `TrustSignals.tsx` (delivery, COD options, warranty), `DeliveryBanner.tsx` (flat delivery fee from `siteConfig`, order-status hero copy).
May NOT touch: layout, Header/Footer, ProductCard, format helpers, any action.

**Verification (Checkpoint 2):** tsc/eslint clean → `runner` boots + `/` 200 + featured section non-empty (seed has 8 featured) → **quality gate** (uiux + accessibility focus; verdict).

## Phase C — Buying flow (ONE agent at a time, owns only its routes)

**Inter-screen contracts (read by all):**
- Catalog search params: `q` (search), `cat` (category slug), `sort` (`newest|price-asc|price-desc|featured`), `cursor` (opaque). Sort/filter changes reset `cursor`. Links preserve unrelated params. Product links = `/products/{slug}`.
- Slug = seed kebab-case (see `prisma/seed.ts`); id (cuid) is the payload for ALL cart/actions; slug only for URLs + product pages.
- Cart state lives server-side (cookie `cart_token` or user cart, both handled by `lib/cart`); screens read via `getCartAction`/server `getCart()` and mutate via actions; after each action `router.refresh()`.

### C-1 `catalog-agent` — `/products`
Files: `src/app/(store)/products/page.tsx` (server: `searchParams` → `getCatalogPage`) + `_components/`: `ProductGrid.tsx`, `FilterSidebar.tsx` (category chips + counts from `getCatalogPage().categories`), `SortSelect.tsx` (searchParams-contract, client, push `sort`), `PaginationBar.tsx` (client `PaginationLoadMore`, appends `cursor`), `SearchBox` reuse.
**C-1 verification** (folded into C-3 gate; smoke: `npm run dev` + manual /products loads with seeded categories).

### C-2 `product-page-agent` — `/products/[slug]`
Files: `src/app/(store)/products/[slug]/page.tsx` + `_components/`: `Gallery.tsx` (hero = `imageUrls[0]` + thumbs, next/image), `SpecsTable.tsx`, `PriceBlock.tsx` (`Price` + currency), `StockStatus.tsx` (0 → out of stock/disabled; ≤ lowStockThreshold → "Only X left"), `QuantityPicker.tsx` (client `QuantityStepper` capped at stock), `AddToCartButton.tsx` (client: `useCart.add(productId, qty)` + `Toast` + `router.refresh`), `RelatedProducts.tsx` (`getProductDetail` → `getRelated` → `ProductCard`). `generateMetadata` + `notFound()` for deleted/unpublished slugs (`getProductDetail` filters `isPublished`/`deletedAt`).
**Contract**: add-to-cart payload `{productId: string, quantity: number}` (cartItemSchema); server caps at stock.

### C-3 `cart-agent` — `/cart`
Files: `src/app/(store)/cart/page.tsx` (server shell: `getCart()` → CartDTO) + `_components/`: `CartLineItems.tsx` (client rows: image, name→/products/{slug}, unit price, `QuantityStepper` bound to `useCart.updateQty` (max=stock), line total, remove → `removeCartItemAction`), `OrderSummary.tsx` (subtotal / deliveryFee / total via `formatRWF`; VAT-inclusive note), `CheckoutCta.tsx` (→ /checkout; disabled when empty), `EmptyCartState.tsx` (EmptyState + CTA /products).
**C-1..C-3 all verify inside Checkpoint 3.**

### C-4 `checkout-agent` — `/checkout` + `/checkout/success`
Files: `src/app/(store)/checkout/page.tsx` (server shell: cart via `getCheckoutCartAction`, `siteConfig` fee + MoMo number + bank details as props — server-only must NOT leak to client bundle) + `_components/`: `ShippingForm.tsx` (fields name/phone/email?/address/city? mirror `checkoutSchema`; field errors from `details.fieldErrors`), `PaymentMethodPicker.tsx` (3 radios; BANK_TRANSFER shows required reference input, client mirror of regex; selection cleared when switching), `PaymentInstructionsPanel.tsx` (post-submit rendering), `OrderSummaryPanel.tsx`, `PlaceOrderButton.tsx` (client: `useActionState(createOrderAction)`, disable while pending, `superRefine`-client mirror), `SuccessScreen.tsx`.
- **FLAG (decision for orchestrator):** guest success page needs order data with NO auth. Recommended: small `backend-agent` follow-up action `getCheckoutOrderAction(orderId)` (public fetch by high-entropy order id, returns OrderDTO + paymentInstructions) — do this BEFORE C-4. Fallback (no backend change): `PlaceOrderButton` holds `CheckoutResult` on success, `router.replace('/checkout/success?order='+id)`, success client reads sessionStorage with graceful fallback (order summary lost on refresh → EmptyState "we have your order — contact us").
- Success page `src/app/(store)/checkout/success/page.tsx`: guarded (no/empty order param → `redirect('/')`), shows order number + status PENDING, `paymentInstructions` (title+steps; BANK_TRANSFER shows `order.number` as reference + manual-verification note; MoMo shows number from instructions), summary, pixel-level CTAs: continue browsing / view orders (if session).

### C-5 `account-agent` — `/login`, `/register`, `/account`, `/account/orders`, `/account/orders/[id]`
Files: `src/app/(store)/login/page.tsx` (+`LoginForm.tsx` client; reads `?next` search param, sanitize starts-with-/ against open redirect, `loginAction` → push sanitized next, else /account), `src/app/(store)/register/page.tsx` (+`RegisterForm.tsx`; `registerAction` auto-creates session → navigate /account), `src/app/(store)/account/page.tsx` (profile prefill `getSession()` user; `updateProfileAction` via client profile form), `src/app/(store)/account/orders/page.tsx` (server shell → `getMyOrdersAction({cursor,limit})` load-more table: number, date, items summary, total, status Badge, paymentStatus) + `_components/OrderHistoryTable.tsx` (client load-more `PaginationLoadMore`), `src/app/(store)/account/orders/[id]/page.tsx` (→ `getMyOrderAction({orderId})`) rendering `OrderDTO` detail: items table, totals, payment method + PaymentDTO status, `paymentInstructions` block, status timeline (PENDING→PAID→FULFILLED + CANCELLED/REFUNDED), address snapshot.
**Idempotency note:** `createOrderAction` reuses `idempotencyKey=cart.id` — double-submit returns the SAME order (UI: disable submit + "Order already placed" guard on success page).

**Verification (Checkpoint 3 — whole storefront):** tsc/eslint → `npm test` → `npm run build` once → `runner` boots + curl each public route 200 + add-to-cart smoke against seeded products → **tdd-guide**: `tests/integration/storefront/{cart,checkout,account}.test.ts` (jsdom) → **quality gate** (code-reviewer, frontend-reviewer, uiux-reviewer, accessibility-auditor — single pipeline owned by quality-agent).

## Phase D — Critical journeys (`e2e-runner`)

Files: `e2e/pages/` PO models (`HomePage`, `CatalogPage`, `ProductPage`, `CartPage`, `CheckoutPage`, `SuccessPage`, `AuthPage`, `AccountPage`), 4 specs near `e2e/specs/critical-journeys.spec.ts` (+ maybe auth + order-history spec):
1. browse→product→cart→(guest) checkout COD_CASH→success with payment instructions.
2. BANK_TRANSFER flow: reference required (invalid ref blocked), after success instructions include order number.
3. register→add→checkout (logged-in)→order appears in `/account/orders` + detail shows status.
4. stock-edge — safety-vest (stock 0) blocked in cart quantity, product page disabled.
Serial spec manner (workers:1), seeded test DB (5435) via existing global-setup (migrate reset + seed). Use `data-testid`/ARIA roles only where ambiguous; screens must expose stable hooks (semantic labels per accessibility skill).

**Verification (Checkpoint 4):** `npm run test:e2e` (config bootstraps dev on test DB) → triage UI failures to owning screen agent and re-run until green → **quality gate** (adds security-reviewer + performance-optimizer; final storefront verdict).

## Phase E — Dashboard (follow-on; no detail)
`dashboard-agent` builds `src/app/admin/layout.tsx` shell (sidebar, `requireAdmin` guard wiring, admin primitives in `src/components/admin/*`) → then 5 screen agents per SCREENS.md (`inventory-agent`, `stock-agent`, `orders-screen-agent`, `customers-screen-agent`, `sales-agent`, one at a time, quality gate per checkpoint). KPI/orders/delivered-payments data services already exist (`src/actions/admin/*`, `src/lib/orders-admin.ts`, `src/lib/sales.ts`). The **manual BANK_TRANSFER verification workflow** (demo centerpiece) lands here.

---

## Risks / flags

1. **Missing action (decision needed):** order lookup for guest success page — no public `getOrder(id)` action exists; `getMyOrderAction` is IDOR-gated. Recommend `backend-agent` follow-up `getCheckoutOrderAction(orderId)` before C-4; fallback sessionStorage flows documented (loses data on hard refresh).
2. **Route-group relocation:** root `src/app/page.tsx` placeholder moves to `(store)/page.tsx` in Phase A (mechanical; homepage-agent owns content in Phase B). Other screen agents must create files under `(store)/…` — consistent with SCREENS.md ownership.
3. **Cart cookie churn:** header CartBadge calls `getCart()` → creates cart row + `cart_token` cookie on EVERY anonymous first visit (by design of `ensureCart`). Acceptable for demo; noted for later optimization.
4. **No new npm deps:** chosen data pattern (server fetch + useActionState + revalidateTag + router.refresh) avoids SWR/React Query and any `package.json` change (shared-file governance).
5. **Related products** — `listPublished` can't exclude the current slug: filter server-side in `getRelated`; pad from featured. No repo change.
6. **MoMo/bank details on checkout screen (pre-order):** must be passed as server-props from `siteConfig` — never imported client-side (server-only guard).
7. **Cursor pagination everywhere** (catalog, order history) — "Load more" UX, no page numbers; reset cursor on filter/sort change.
8. **superRefine mirror:** bankTransferReference required ⇔ method BANK_TRANSFER; regex `/^[A-Z0-9-]{4,40}$/i` mirrored in client validation AND enforced by server (`checkoutSchema`) — trust server errors.
9. **Ownership enforcement:** screen agents must not add `components/ui/*` or edit foundation files; quality-agent code-review sub-gate enforces. New floor-of-missing-primitive requests go via orchestrator → frontend-agent ONLY.
10. **Vitest**: component tests need `// @vitest-environment jsdom`; `tests/` and `e2e/` are single-owner dirs (tdd-guide / e2e-runner).

## Open decisions (raise to orchestrator before starting C-1)
- A. Approve `backend-agent` follow-up action `getCheckoutOrderAction(orderId)` (recommended) or use client-held success fallback.
- B. Accept cart-badge create-on-first-visit behavior (recommended) or hide badge for anonymous users.
- C. Confirm `(store)` route group naming (no URL impact; used to isolate admin shell in Phase E).
