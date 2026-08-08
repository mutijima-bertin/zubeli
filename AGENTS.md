# Zubeli — Project Doc

*Last updated: 2026-08-08*

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
- Model for the build: ECC-style agent setup (based on github.com/affaan-m/ECC) — one agent = one task (backend-only, frontend-only, etc.), skills as SKILL.md files, wired via opencode.json

## Decided (2026-08-05)
- Country: Rwanda, currency: RWF
- MVP payment method: Pay on Delivery — three customer options: (a) cash at delivery, (b) mobile money (MTN MoMo / Airtel Money code at the door), (c) bank transfer with **manual** verification in the dashboard. No payment gateway integration in the MVP.
- Order status lifecycle: PENDING -> PAID (only via manual confirmation by owner in dashboard now, or via verified webhook later) -> FULFILLED, plus CANCELLED/REFUNDED
- `paymentMethod` must be a future-proof enum (`COD_CASH`, `COD_MOBILE_MONEY`, `BANK_TRANSFER`; later `MOMO_GATEWAY`, `CARD`); keep the payment-provider abstraction so an MTN MoMo / Airtel gateway can be added after the contract is signed
- Client has **not** paid the builder yet; the MVP is a demo to show the company. Real gateway integration is deferred until the contract is signed and payment is received.

## Decided (2026-08-06)
- Roster expanded 35 -> 38 agents, plus a new **Operations** category: `organizer` (repo hygiene/the cleanliness audits), `runner` (starts and verifies the app; triages failures to the owning agent and re-runs until green), `quality-agent` (owns the quality gate — spawns the reviewer suite as its sub-agents and issues the verdict).
- Skills expanded 19 -> 22: added `subagent-delegation`, `repo-organization`, `project-runner`.
- Repo is local-only (lightweight git on `main`, NO remote). No agent pushes/publishes without the user's explicit approval — see Publishing guardrail below.

## Agent roster (38 agents, one task each)

- **Coordination (2):** `orchestrator` (primary, the switchboard), `planner`
- **Operations (3):**
  - `organizer` — repository hygiene / cleanliness audits
  - `runner` — starts the app, verifies it runs; triages failures to the owning agent and re-runs until green
  - `quality-agent` — owns the quality gate: spawns the reviewer suite as child sub-agents and issues the verdict
- **Architecture (1):** `architect`
- **Foundations (2):** `frontend-agent` (storefront design system), `dashboard-agent` (admin shell)
- **Build (2):** `database-agent` (Prisma schema/migrations/seed), `backend-agent` (API/auth/logic/payments)
- **Storefront screens (6):** `homepage-agent`, `catalog-agent`, `product-page-agent`, `cart-agent`, `checkout-agent`, `account-agent`
- **Dashboard screens (5):** `inventory-agent`, `stock-agent`, `orders-screen-agent`, `customers-screen-agent`, `sales-agent`
- **Quality reviewers (4):** `code-reviewer`, `security-reviewer`, `performance-optimizer`, `build-error-resolver` — the review *gate* is owned by `quality-agent`; these four act only as its child reviewers
- **Review (5, read-only):** `database-reviewer`, `backend-reviewer`, `frontend-reviewer`, `uiux-reviewer`, `accessibility-auditor`
- **Testing (2):** `tdd-guide`, `e2e-runner`
- **DevOps & docs (3):** `devops-agent`, `release-manager`, `docs-writer`
- **Growth (3, post-MVP):** `marketing-agent`, `seo-specialist`, `content-writer`

## Skills (22, SKILL.md files)

`tdd-workflow`, `frontend-patterns`, `backend-patterns`, `api-design`, `postgres-patterns`, `prisma-patterns`, `security-review`, `e2e-testing`, `deployment-patterns`, `docker-patterns`, `github-ops`, `git-workflow`, `accessibility`, `ui-design-principles`, `performance-patterns`, `seo`, `marketing-campaign`, `content-writing`, `payment-integration`, `subagent-delegation`, `repo-organization`, `project-runner`

## Delegation & reports

- **Photographer model:** any agent whose assigned job is too big may spawn child sub-agents (one task per child). Children report ONLY to their parent; the parent verifies the work and aggregates the results. Maximum 2 levels deep. Follow the `subagent-delegation` skill.
- **Summary reports:** after any completed task or review, every agent leaves a summary at `docs/reports/<date>-<agent>-<slug>.md` containing: what was done, files touched, verification evidence (commands + results), and next steps. Keep it short (10-15 lines). `docs/reports/README.md` is the index — `docs-writer` maintains it.
- **Publishing guardrail:** the repository is local-only and has NO git remote. No agent ever runs `git push`, adds a remote, or opens/publishes anything publicly (PRs, releases, CI/CD deploys) without the user's EXPLICIT approval. CI/CD files are written locally only.

## Working model

- Route ownership: `docs/SCREENS.md` (one owner per route, no shared-file edits)
- Screen agents may run in parallel when their owned files are disjoint — see Fast dispatch protocol below; reviewers run only as sub-agents spawned by `quality-agent`, which owns the single quality pipeline and issues the verdicts
- `runner` boots the app and verifies it runs; on failure the task is triaged back to the owning agent and re-run until green
- Contract files: `AGENTS.md`, `docs/SCREENS.md`, `prisma/schema.prisma`, `types/*`, test suite
- Config: `opencode.json` (default agent: orchestrator). RESTART opencode after config changes.

### Fast dispatch protocol (decided 2026-08-07)

- **Parallel dispatch:** `orchestrator` may dispatch multiple agents concurrently whenever their owned files are disjoint per `docs/SCREENS.md` (e.g. `catalog-agent` on `/products`, `product-page-agent` on `/products/[slug]`, `cart-agent` on `/cart` — they consume but never edit shared foundations). Read-only reviewers already run in parallel. Sequential execution only on true dependency (e.g. backend follow-up before `checkout-agent`).
- **Session reuse:** follow-up fixes resume the prior agent's session via `task_id` instead of spawning a fresh agent — avoids cold-start context re-reading.
- **Tight briefs:** `orchestrator` pre-loads exact contract shapes (DTO fields, action signatures, file paths, allowed-file lists) into the dispatch prompt so agents skip contract re-reading. Screen agents should NOT re-read full contract files when the brief already contains what they need.
- **Verification tiers:** screen agents verify their OWN scope only — `npx tsc --noEmit` + `npm run lint` (plus their own route smoke IF no dev-server port conflict; otherwise defer smoke to `runner`). The full test suite + production build + reviewer suite run ONCE per milestone checkpoint via `runner` and `quality-agent`, NOT per agent. This replaces the "every agent runs everything before reporting done" expectation for screen work.

## Current status
- Local git repo on `main` (no remote; publishing requires explicit user approval)
- Agent roster (38) + skills (22 SKILL.md) wired via `opencode.json`; route ownership contract in `docs/SCREENS.md` (both bases created 2026-08-03, expanded 2026-08-06)
- Infrastructure + backend COMPLETE and smoke-verified (2026-08-05-06): Next.js 15 scaffold, Vitest + Playwright harnesses, Docker Postgres (dev 5434 / test 5435), ADRs 0001-0004, Prisma schema + seed (30 products, 10 categories, 15 orders, 1 admin + 2 demo customers), plus the full backend layer (auth/sessions, carts, orders lifecycle, payment providers, admin actions, health endpoint)
- Homepage (Phase B) BUILT + verified (2026-08-07): `src/app/(store)/page.tsx` + `_components/{Hero,FeaturedProducts,CategoriesShowcase,TrustSignals,DeliveryBanner}` — found already on disk, a11y-conscious, no builder report left; `runner` Checkpoint 2 PASS (hero + 8 featured products render real seed data)
- Storefront COMPLETE + gate closed; Phase D e2e BUILT (1 bug being fixed); dashboard next — catalog, product pages, cart, checkout, account (Phase C) all built per fast-dispatch protocol; `runner` Checkpoint 3 PASS
- Milestone 3 storefront RE-GATE CLOSED (2026-08-07, quality-agent): FINAL verdict PASS-WITH-BACKLOG — F1 (FilterSidebar count-chips → stone-500), F2 (login sanitizeNextPath rejects auth routes), F3 (product JSON-LD escaped \u003c) all fixed and verified; tsc 0, lint 0, vitest 264/264 (15 files). Report: docs/reports/2026-08-07-quality-agent-storefront-gate.md (RE-GATE section).
- Milestone 4 e2e suite BUILT (2026-08-07, e2e-runner): 5 specs / 15 tests in e2e/ (browse/cart/checkout/account/auth), PO models in e2e/pages/; 14/15 PASS — 1 app bug (src/actions/account.ts:48 revalidatePath-on-read → INTERNAL on order detail) in flight, account-agent fix under way. Report: docs/reports/2026-08-07-e2e-runner-milestone4.md.
- Phase E admin e2e GREEN (2026-08-08, e2e-runner): 11 specs / 29 tests ALL PASS (3m08s) — customer suite 15 + admin suite 14 (login/guards 3, orders 3, products 3, stock 1, customers 2, sales 2). Harness fix: owner session bootstrapped in e2e/global-setup.ts (one real login per run — rate-limiter safe); 3 spec bugs fixed (label exact-matching, aria-label substring strict mode, admin-stock restores safety-vest stock to 0 to protect browse.spec's out-of-stock invariant). No app bugs found. Report: docs/reports/2026-08-08-e2e-runner-phase-e.md.
- Milestone 5 dashboard gate CLOSED (2026-08-08, quality-agent): FINAL verdict PASS-WITH-BACKLOG — tsc 0, lint 0, vitest 264/264 (15 files), build PASS, zero CRITICAL/HIGH findings, zero fix dispatches. New backlog: M1 (stock KPIs from limit:100 list silently wrong >100 products — needs backend lowStock filter/KPI endpoint), M2 (customers KPI cards aggregate loaded rows only, no disclosure), L1 (LogoutButton unhandled rejection), L2 (StatusActions same), L3 (guest rowKey phone+name collision), L4 (MovementsLedger → storefront 404 for unpublished products), L5 (listAll productCount over-fetch). Known gaps G1–G5 confirmed minor/expected. Report: docs/reports/2026-08-08-quality-agent-dashboard-gate.md.
- FINAL RUNNER CHECKPOINT PASS (2026-08-08, runner): fresh run, all 10 steps green — tsc 0, lint 0 (2 known e2e warnings), vitest 264/264 (15 files, 5.7s), e2e 29/29 (11 specs, 3.1m), build PASS **23 routes / 10 `/admin/*` ƒ** (earlier reports said 24/11 — that was a miscount; disk matches docs/SCREENS.md exactly), health {ok,db:up}, / 200, /admin guest 307→/login?next=/admin, /products 200, owner HTTP smoke 200 on /admin + /admin/orders + /admin/sales + /account (throwaway session, cleaned after). Report: docs/reports/2026-08-08-runner-final-checkpoint.md.
- Pro-max design pass (2026-08-08): uiux-reviewer audit vs vendored skill set docs/reference/ui-ux-pro-max-skill/ (zero P0, 4 P1 + 16 P2); foundation + screen wave implemented ALL of #1–#15 (incl. hero collage, checkout mobile order, password toggles, DataTable sortable table, admin toast, chart v2); full checkpoint PASS by runner (tsc/lint/vitest/e2e/build numbers as runner reported — docs/reports/2026-08-08-runner-pro-max-checkpoint.md); reports index updated.
- Commerce polish (2026-08-08): real product photos (16 in public/images/products/stock/) mapped to 8 products + 8 new catalog products (rhinoceros-bow-saw from user's rinco), featured 8→5, wheelbarrow→site-equipment; catalog price/availability filters + multi-field search; card polish (4/3, stock line, 'Add to cart'); PDP trust strip; checkpoint PASS by runner (numbers as reported — docs/reports/2026-08-08-runner-commerce-checkpoint.md); reports index updated.
- Open work: backlog sweep (M1/M2/L1–L5 + carried storefront backlog) at the hosting milestone, hosting + CI/CD (local files ready; live publish only with explicit user approval), post-MVP growth

## What remains (next work)
- [x] Payment method + country: decided 2026-08-05 — see Decided section
- [x] Local git repo — set up (run off `main`; NO remote — see Publishing guardrail)
- [x] opencode.json + agent roster (38 agents) + skills (22 SKILL.md)
- [x] Scaffold Next.js + TypeScript + PostgreSQL (Prisma)
- [x] Data model: products, categories, inventory, users, customers, orders, order items, payments
- [x] Backend: auth/sessions, carts, orders lifecycle, payment providers, admin business logic, health endpoint
- [x] Test harnesses: Vitest (unit/integration) + Playwright (e2e) configured and running
- [x] Homepage (Phase B): built + verified — `runner` Checkpoint 2 PASS (2026-08-07)
- [x] Buying-flow screens: catalog, product pages, cart, checkout, customer accounts, order history — Phase C complete; Milestone 3 gate closed PASS-WITH-BACKLOG (2026-08-07)
- [x] Dashboard screens: products, stock, orders, customers, sales — shell + 5 screens complete (2026-08-07); Milestone 5 gate closed PASS-WITH-BACKLOG (2026-08-08)
- [x] e2e specs for the critical customer and admin journeys — customer suite (5 specs / 15 tests) + Phase E admin suite (11 specs / 29 tests ALL PASS, 2026-08-08); no app bugs
- [x] Release notes for the client demo (2026-08-08) — `docs/release-notes/2026-08-08-mvp-demo.md`
- [ ] Backlog sweep (at hosting milestone): M1 stock KPIs wrong >100 products (backend lowStock filter/KPI endpoint), M2 customers KPI "loaded rows" disclosure, L1–L5 (LogoutButton/StatusActions unhandled rejections, guest rowKey collision, MovementsLedger dead-end link, listAll over-fetch) + carried storefront backlog (L1–L8 + carry-forwards); M1/M2 escalate to HIGH if still open
- [ ] Hosting + deployment (CI/CD) — written locally; live publishing only with user approval
- [ ] Post-MVP: SEO, marketing, customer retention