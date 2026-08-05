# Zubeli Demo MVP — Build Plan

- Date: 2026-08-05. Status: ready for execution. Author: planner (via orchestrator).
- Note: the client has not paid the builder; this MVP is a demo to show Zubeli Company Ltd. Real payment-gateway integration is deferred until contract signed.

## 0. Planning decisions (contract for all agents)

1. Path convention: `src/` root — `src/app`, `src/components`, `src/lib`, `src/types`, `src/actions`; `prisma/` at root; `tests/`, `e2e/`. Agent briefs saying `app/*`, `lib/*` read as `src/app/*`, `src/lib/*`.
2. Money: integer minor units (`priceCents`, `totalCents`, `deliveryFeeCents` Int columns) + currency default "RWF". 1 minor = 1 RWF.
3. Order state: ONE `OrderStatus` enum (PENDING, PAID, FULFILLED, CANCELLED, REFUNDED) + separate `Payment` record per order.
4. Mutations: server actions in `src/actions/*`; route handler only for `GET /api/health`. Both are backend-agent territory.
5. Guest checkout allowed: Order carries customer snapshot (name/phone/email/address), `userId` nullable; guest cart keyed by server-side `cartToken` cookie.
6. Sessions: DB-backed `Session` table, sha256 token hash, httpOnly cookie, 30-day, rotate on login. `bcryptjs` for passwords (pure JS, no node-gyp).
7. Images: `imageUrl` string on Product; seed points to local SVG placeholders in `public/images/products/*`; dashboard form takes URL input only.
8. Delivery fee: flat `DELIVERY_FEE_CENTS=2000` via env (server-only). Prices VAT-inclusive, no tax line in MVP.
9. Shared-file governance: `package.json` / `tsconfig.json` are shared — agents request edits via orchestrator, never edit directly.
10. Test DB: `zubeli-postgres-test` on 5435 (DB `zubeli_test`); reseeded via `prisma migrate reset` + seed in Playwright `globalSetup`.
11. Payment abstraction: `PaymentProvider` interface (`createPayment` / `verifyWebhook` / `refund`) with `PayOnDeliveryProvider`, `BankTransferProvider`, `MockProvider`; registry `getPaymentProvider(method)`; `paymentMethod` enum `COD_CASH`, `COD_MOBILE_MONEY`, `BANK_TRANSFER` (future: `MOMO_GATEWAY`, `CARD`). Only owner manual confirm (or future webhook) moves PENDING→PAID.

## 1. Phases and ordered steps

### Phase 0 — Bootstrap

1. Repo init — orchestrator — `git init`, `.gitignore`, initial commit. DONE (2026-08-05).
2. Architecture decision records — architect — `docs/adr/README.md` + `0001-data-model`, `0002-auth-model`, `0003-payment-abstraction`, `0004-api-and-error-contract`.
3. Local Postgres via Docker — devops-agent — `docker-compose.yml` (`zubeli-postgres:5434`, `zubeli-postgres-test:5435`; `postgres:16-alpine`, named volumes, healthchecks), `.env.example`, `.env.local`, `.dockerignore`. NEVER touch `css-postgres` (5432)/`css-postgres-test` (5433).
4. Next.js scaffold — frontend-agent — `create-next-app@15` pinned (`--typescript --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*"`), `src/app/layout.tsx` root layout + metadata, `tailwind.config.ts` brand tokens (amber/yellow construction palette), `globals.css`.
5. Vitest harness — tdd-guide — `vitest.config.ts`, `tests/setup.ts`, scripts `test`/`test:watch`/`test:coverage`.
6. Playwright harness — e2e-runner — `playwright.config.ts` (`webServer` dev on `TEST_DATABASE_URL`), `e2e/global-setup.ts` (migrate reset + seed), scripts `test:e2e`.

### Phase 1 — Data layer

7. Prisma schema + migrations + repositories + seed — database-agent — `prisma/schema.prisma` per ADR 0001, migrations, `prisma/seed.ts` (idempotent: 10 categories, ~30 products with RWF prices incl. 1 out-of-stock + 3 low-stock + 8 featured, 1 owner + 2 customers, ~15 orders over last 90 days incl. a PENDING bank-transfer order with reference), `src/lib/db.ts` singleton, `src/lib/db/*` repositories (products, categories, cart, orders, inventory, users, sales).
8. Data-layer tests — tdd-guide — `tests/unit/db/*`.

### Phase 2 — Backend core

9. Backend implementation — backend-agent — `src/types/api.ts` (DTOs + `ActionResult<T>` + pagination envelope), `src/lib/errors.ts`, `src/lib/validation/*` (zod v4), `src/lib/rate-limit.ts`, `src/lib/auth/*` (session, password, guards) + `middleware.ts` (protect `/admin/*` and `/account/*`), `src/lib/cart.ts`, `src/lib/orders.ts` (checkout in one `$transaction`: validate stock → decrement → create Order + items snapshot + `InventoryMovement` + Payment PENDING → clear cart; idempotency by cart), `src/lib/inventory.ts`, `src/lib/payments/*` (provider abstraction), `src/lib/orders-admin.ts` (`confirmOrderPayment` owner-only, bank reference required for `BANK_TRANSFER`; fulfill; cancel; refund), `src/lib/sales.ts`, `src/actions/*` (auth, cart, checkout, account, admin/products, admin/stock, admin/orders, admin/customers, admin/sales), `src/app/api/health/route.ts`, `src/lib/site.ts` (shop MoMo number, bank details, delivery fee).
10. Backend tests — tdd-guide — unit + integration (coverage ≥80% on `src/lib`, `src/actions`). Key cases: out-of-stock, qty>stock, confirm payment non-owner rejected, bank transfer without reference rejected, cancel restocks, double-submit idempotency.
11. Backend review wave (parallel, read-only) — database-reviewer, backend-reviewer, security-reviewer, code-reviewer.

### Phase 3 — Storefront (foundations + 10 routes)

12. Storefront foundations — frontend-agent — `src/components/ui/*` (Button, Card, Input, Label, Select, Badge, Modal, Skeleton, EmptyState, Alert, FormField, QuantityStepper, PriceTag, Toast), `src/components/storefront/*` (Header w/ CartBadge, Footer, NavBar, CategoryNav, ProductCard, SearchBar, MobileMenu), `src/lib/hooks/useCart.ts` + `useProducts.ts` + `useToast.ts`, `src/lib/format.ts` (`formatRWF` with Intl fallback + "RWF" prefix, `formatDate`), `src/lib/site-config.ts`, `public/images/products/*.svg` (~12 branded placeholder SVGs).
13. Home — homepage-agent — `src/app/page.tsx` + `_components` (Hero, FeaturedProducts, CategoriesShowcase, TrustSignals, DeliveryInfo banner).
14. Catalog — catalog-agent — `src/app/products/page.tsx` + `_components` (ProductGrid, FilterSidebar, SortSelect, SearchBox, PaginationBar); filters/sort/pagination in URL search params.
15. Product detail — product-page-agent — `src/app/products/[slug]/page.tsx` + `_components` (Gallery, SpecsTable, PriceBlock, StockStatus, QuantityPicker, AddToCart); `generateMetadata` + `generateStaticParams`; qty capped at stock.
16. Cart — cart-agent — `src/app/cart/page.tsx` + `_components` (CartLineItems, QtyControls, OrderSummary).
17. Checkout + confirmation — checkout-agent — `src/app/checkout/page.tsx` + `_components` (ShippingForm, PaymentMethodPicker, PaymentInstructionsPanel, OrderSummaryPanel, PlaceOrderButton) + `src/app/checkout/success/page.tsx`. Payment picker: 3 radios (Cash at delivery / Mobile money at door showing shop MoMo code / Bank transfer with REQUIRED reference field zod-validated); provider slot calls `getPaymentProvider` — no hardcoded payment branches outside this component. Success page guarded (no order id → redirect).
18. Auth + account — account-agent — `src/app/login`, `/register`, `/account`, `/account/orders`, `/account/orders/[id]`.
19. Storefront tests — tdd-guide — `tests/integration/components/*`.
20. Storefront review wave (parallel) — frontend-reviewer, uiux-reviewer, accessibility-auditor, code-reviewer.

### Phase 4 — Dashboard (foundations + 10 routes)

21. Dashboard foundations — dashboard-agent — `src/app/admin/layout.tsx` (sidebar: Overview, Products, Stock, Orders, Customers, Sales; `requireAdmin` guard wiring), `src/components/admin/*` (DataTable, StatCard, ChartCard, StatusBadge, FilterBar, EmptyState, Pagination, ConfirmDialog, PageHeader, StatusTimeline), `src/lib/admin-format.ts`.
22. Product management — inventory-agent — `src/app/admin/products` (+ `/new`, `/[id]/edit`).
23. Stock — stock-agent — `src/app/admin/stock` (StockTable, AdjustStockModal, RestockPanel, LowStockAlert).
24. Order management + MANUAL PAYMENT VERIFICATION WORKFLOW (demo centerpiece) — orders-screen-agent — `src/app/admin/orders` + `/[id]`: PaymentPanel shows method + instructions; for `BANK_TRANSFER` shows customer reference prominently (missing ref → warning); "Confirm payment received" button (enabled only when PENDING) → Payment PAID + Order PAID + `paidAt`; then "Mark fulfilled" → FULFILLED; Cancel restocks; Refund → REFUNDED. Forbidden transitions blocked with typed errors.
25. Customers — customers-screen-agent — `src/app/admin/customers` + `/[id]` (order history + lifetime totals).
26. Sales overview + reports — sales-agent — `src/app/admin` (KPI cards: revenue, orders, avg order value, low stock, pending payments; revenue-by-month chart; top products) + `src/app/admin/sales` (period filters, charts).
27. Dashboard tests — tdd-guide — coverage ≥80% maintained.
28. Dashboard review wave (parallel) — frontend-reviewer, uiux-reviewer, accessibility-auditor, security-reviewer, code-reviewer, performance-optimizer (light).

### Phase 5 — E2E, docs, release, acceptance

29. Playwright suite — e2e-runner — `e2e/pages/*` + `e2e/specs`: `storefront-journey` (browse→cart→checkout COD→success→order history), `bank-transfer-verification` (customer places order with reference → owner confirms → PAID → fulfill → FULFILLED), `auth-guards` (anonymous redirected from `/admin/*` and `/account/*`), `admin-crud` (create product → live on storefront; stock adjust → low-stock; sales KPIs update), `critical-states` (empty cart, out-of-stock CTA disabled, checkout validation).
30. Final hardening — build-error-resolver + security-reviewer/code-reviewer final pass. Full gate: lint + tsc + vitest + playwright + build.
31. Infra/ops closure (local scope) — devops-agent — `.env.example` finalization, `db:reset` convenience script documented.
32. Documentation — docs-writer — `README.md` (setup: compose up → migrate → seed → dev; demo credentials; demo script checklist), `docs/API.md`, `AGENTS.md` status update, `SCREENS.md` check.
33. Release — release-manager — `CHANGELOG.md`, version 0.1.0, tag `v0.1.0` (deployment deferred).
34. Final acceptance gate — orchestrator — full green + demo script walkthrough on freshly reseeded 5434 DB.

## 2. Dependency graph (summary)

1 git init → 2 ADRs → 7 schema+seed → 9 backend → 11 review → 12 storefront foundations → 13–18 screens → 19 tests → 20 review → 21 dashboard foundations → 22–26 screens → 27 tests → 28 review → 29 e2e → 30–33 hardening/docs/release → 34 acceptance.

Steps 3, 4, 5, 6 parallel after step 1. Reviewers always run in parallel waves (steps 11/20/28/30). tdd-guide gates: G1 after DB, G2 after backend (heaviest), G3 after storefront, G4 after dashboard. build-error-resolver intervenes on any red build, never in parallel with an owning agent. security-reviewer mandatory after auth/payments/admin milestones.

## 3. Demo strategy

- Seed: 10 categories (Power Tools, Hand Tools, Safety Gear, Construction Materials, Fasteners & Fixings, Measuring & Layout, Plumbing, Electrical, Painting & Finishing, Site Equipment); ~30 products with benefit-led descriptions and RWF prices (e.g. Power Drill 85,000; Angle Grinder 65,000; Hammer 12,500; Wheelbarrow 48,000; Cement 50kg 9,800; Safety Helmet 4,500; Measuring Tape 3,200; Extension Ladder 210,000); 1 out-of-stock, 3 low-stock (≤5), 8 featured. Owner: `owner@zubeli.rw` / `DemoPass2026!` (env-overridable, dev-only). Customers: `umutoni@demo.rw`, `eric@demo.rw`. ~15 orders over last 90 days (relative dates) across statuses incl. one PENDING BANK_TRANSFER with reference.
- Demo script: storefront tour → COD cash order → appears in `/admin/orders` → bank-transfer order → owner confirms payment in dashboard (reference shown) → PAID → FULFILLED → create product → live on storefront → stock adjust → low-stock badge → KPIs/charts update.
- Payment talk track: "Today the store accepts pay-on-delivery in three ways — cash, mobile money at your door, or bank transfer confirmed manually in the dashboard. The payment layer is a pluggable provider, so once we sign the contract we connect MTN MoMo and Airtel Money gateways directly — no rework."
- Reset: `npm run db:reset` (5434) before/after demos.

## 4. Risks

- R1 Prisma↔Docker networking (`DATABASE_URL` host vs container) — single host URL in `.env.local`.
- R2 Port 5434/5435 — verified free; healthcheck gate before migrations.
- R3 Placeholder images — branded SVG tiles.
- R4 Demo DB drift — `db:reset` + seed dates relative to `now()`.
- R5 bcrypt native build — `bcryptjs` chosen.
- R6 `create-next-app` Next 16 — pin `@15`.
- R7 Intl locale for RWF — fallback grouping + "RWF" prefix, unit-tested.
- R8 Cancel/refund restock races — same `$transaction`.
- R9 Guest cart cookie loss — server-side `cartToken`; e2e proves persistence.
- R10 Shared-file edits — orchestrator-brokered.
- R11 VAT undefined — VAT-inclusive, flagged.
- R12 Delivery fee policy — flat 2000 RWF env-configurable.

## 5. Deferred (and why)

- Real payment gateway (MTN MoMo/Airtel, cards) — client hasn't paid; abstraction ready.
- File/image upload — URL input + SVGs.
- Email/SMS/password-reset/OTP — out of MVP.
- SEO/marketing/content — post-MVP.
- Deployment/CI (Dockerfile, GitHub Actions, hosting) — demo runs locally until contract.
- Refunds with real money movement.
- Multi-currency, tax lines, reviews/wishlist.
- Deep performance pass.

## 6. Open questions (non-blocking)

- Q1 Flat delivery fee RWF 2,000 — default accepted unless user objects.
- Q2 Guest checkout — allowed (recommended for demo speed).
- Q3 Shop MoMo number + bank details — placeholders until client provides real ones.
- Q4 Seed owner password — documented dev credential; production must use env + rotation.
