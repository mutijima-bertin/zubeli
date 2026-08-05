# Zubeli — Project Doc

*Last updated: 2026-08-05*

## About the company
Zubeli Company Ltd sells construction tools. Currently operates entirely offline (managing the business by hand) and wants to move online.

## How the project began
The company wants a system that lets them:
- Manage the business online (stock, sales, customers, etc.)
- Attract customers (online presence, marketing)
- Sell goods online (e-commerce storefront)

## Vision / goals
- An online store where customers can browse and buy construction tools
- Business management features: inventory, orders, customers, sales tracking
- A way to attract and retain customers online

## Decided (2026-08-03)
- MVP scope: customer storefront + owner business dashboard (inventory, orders, customers, sales)
- Tech stack: Next.js (React) + TypeScript + PostgreSQL
- Product catalog / stock: built into the app (CRUD in dashboard)
- OPEN: payment method + country (affects checkout design) — mobile money vs cards vs pay-on-delivery
- Model for the build: ECC-style agent setup (based on github.com/affaan-m/ECC) — one agent = one task (backend-only, frontend-only, etc.), skills as SKILL.md files, wired via opencode.json

## Decided (2026-08-05)
- Country: Rwanda, currency: RWF
- MVP payment method: Pay on Delivery — three customer options: (a) cash at delivery, (b) mobile money (MTN MoMo / Airtel Money code at the door), (c) bank transfer with **manual** verification in the dashboard. No payment gateway integration in the MVP.
- Order status lifecycle: PENDING -> PAID (only via manual confirmation by owner in dashboard now, or via verified webhook later) -> FULFILLED, plus CANCELLED/REFUNDED
- `paymentMethod` must be a future-proof enum (`COD_CASH`, `COD_MOBILE_MONEY`, `BANK_TRANSFER`; later `MOMO_GATEWAY`, `CARD`); keep the payment-provider abstraction so an MTN MoMo / Airtel gateway can be added after the contract is signed
- Client has **not** paid the builder yet; the MVP is a demo to show the company. Real gateway integration is deferred until the contract is signed and payment is received.

## Agent roster (35 agents, one task each)

- **Coordination (2):** `orchestrator` (primary, the switchboard), `planner`
- **Architecture (1):** `architect`
- **Foundations (2):** `frontend-agent` (storefront design system), `dashboard-agent` (admin shell)
- **Build (2):** `database-agent` (Prisma schema/migrations/seed), `backend-agent` (API/auth/logic/payments)
- **Storefront screens (6):** `homepage-agent`, `catalog-agent`, `product-page-agent`, `cart-agent`, `checkout-agent`, `account-agent`
- **Dashboard screens (5):** `inventory-agent`, `stock-agent`, `orders-screen-agent`, `customers-screen-agent`, `sales-agent`
- **Review (5, read-only):** `database-reviewer`, `backend-reviewer`, `frontend-reviewer`, `uiux-reviewer`, `accessibility-auditor`
- **Testing (2):** `tdd-guide`, `e2e-runner`
- **Quality (4):** `code-reviewer`, `security-reviewer`, `performance-optimizer`, `build-error-resolver`
- **DevOps & docs (3):** `devops-agent`, `release-manager`, `docs-writer`
- **Growth (3, post-MVP):** `marketing-agent`, `seo-specialist`, `content-writer`

## Skills (19, SKILL.md files)

`tdd-workflow`, `frontend-patterns`, `backend-patterns`, `api-design`, `postgres-patterns`, `prisma-patterns`, `security-review`, `e2e-testing`, `deployment-patterns`, `docker-patterns`, `github-ops`, `git-workflow`, `accessibility`, `ui-design-principles`, `performance-patterns`, `seo`, `marketing-campaign`, `content-writing`, `payment-integration`

## Working model

- Route ownership: `docs/SCREENS.md` (one owner per route, no shared-file edits)
- One agent works at a time; reviewers run in parallel; I (orchestrator) am the only one who launches agents
- Contract files: `AGENTS.md`, `docs/SCREENS.md`, `prisma/schema.prisma`, `types/*`, test suite
- Config: `opencode.json` (default agent: orchestrator). RESTART opencode after config changes.

## Current status
- Fresh project, no code yet
- Not yet a git repo
- Agent roster (35 agents) and skills (19 SKILL.md files) created 2026-08-03; `opencode.json` and `docs/SCREENS.md` (route ownership contract) in place and verified on disk

## What remains (next steps)
- [x] Payment method + country: decided 2026-08-05 — see Decided section
- [ ] Set up git repo
- [x] Create opencode.json + agent roster (one task per agent) + skills (SKILL.md)
- [ ] Scaffold Next.js + TypeScript + PostgreSQL (Prisma)
- [ ] Data model: products, categories, inventory, users, customers, orders, order items, carts
- [ ] Storefront: catalog, product pages, cart, checkout, customer accounts, order history
- [ ] Dashboard: inventory management, order management, customer management, sales tracking
- [ ] Tests (unit/integration/e2e), security review
- [ ] Hosting + deployment (CI/CD)
- [ ] Post-MVP: SEO, marketing, customer retention
