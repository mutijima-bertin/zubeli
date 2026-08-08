# Zubeli — Repository Map

*Where is what in this repository. Written for humans (owners, new agents, the client). Screen agents own routes per `docs/SCREENS.md` — this map is for orientation, not ownership.*

```
zubeli/
├── src/            # the app (backend + frontend)
│   ├── actions/    # SERVER actions (backend logic entry points)
│   ├── app/        # Next.js routes — one folder per URL
│   ├── components/ # UI building blocks
│   ├── lib/        # shared server & client logic
│   ├── types/      # shared TypeScript contracts
│   └── middleware.ts # auth guards for /admin and /account
├── prisma/         # the database: schema, migrations, seed
├── public/         # static assets (product images)
├── tests/          # Vitest — unit + integration
├── e2e/            # Playwright — browser tests (PO models + specs)
├── docs/           # all documentation (see tree below)
├── .opencode/      # agent roster + skills (opencode config)
└── *.config.ts/mjs # root configs (see CONFIG below)
```

---

## BACKEND (server-side)

| Where | What lives here |
|---|---|
| `src/actions/**` | **Server actions** — the app's API surface. 9 domain files, ~35 exported actions, all returning `ActionResult<T>`: `auth.ts`, `account.ts`, `cart.ts`, `checkout.ts`, `admin/products.ts`, `admin/stock.ts`, `admin/orders.ts`, `admin/customers.ts`, `admin/sales.ts` |
| `src/lib/db/**` + `src/lib/db.ts` | Typed Prisma repositories (products, inventory, orders, sales, carts, users, categories, pagination) |
| `src/lib/payments/**` | Payment-provider abstraction (Pay-on-Delivery: cash / mobile money / bank transfer; gateway-ready) |
| `src/lib/validation/**` | Zod schemas for every action's input |
| `src/lib/orders-admin.ts` | Order lifecycle transitions (PENDING → PAID → FULFILLED, CANCELLED, REFUNDED) with stock restocking |
| `src/lib/orders.ts`, `cart.ts`, `products-admin.ts`, `customers-admin.ts`, `sales.ts`, `auth/**`, `rate-limit.ts`, `request.ts`, `dto.ts`, `errors.ts`, `site.ts` | Business logic + auth sessions + rate limiting + DTO mapping |
| `src/lib/storefront.ts` | Server helpers for storefront pages (homepage, catalog, product detail, related) |
| `src/middleware.ts` | Route guards: guests → `/login`, non-owner → `/` for `/admin/**` |
| `src/app/api/health/` | The only HTTP route: `GET /api/health` → `{ok, db: 'up'}` (everything else is server actions) |
| `prisma/**` | **The database**: `schema.prisma` (10 models), `migrations/`, `seed.ts` (30 products, 10 categories, 15 orders, demo users) |

## FRONTEND (client-side)

| Where | What lives here |
|---|---|
| `src/app/**` | One folder per URL (App Router). **Storefront** under `src/app/(store)/` (home, products, product detail, cart, checkout + success, login, register, account + order history); **Dashboard** under `src/app/admin/` (overview, products, stock, orders, customers, sales); **API** under `src/app/api/` |
| `src/components/ui/**` | Design system — buttons, cards, inputs, dialogs, tables, badges, toast (owned by `frontend-agent`) |
| `src/components/storefront/**` | Storefront chrome — header, navbar, footer, product card, search (owned by `frontend-agent`) |
| `src/components/admin/**` | Dashboard widgets — data table, stat cards, charts, sidebar, topbar (owned by `dashboard-agent`) |
| `src/app/**/_components/` | Screen-specific components, colocated with their route |
| `public/images/products/**` | Branded product artwork (12 SVGs) |

## SHARED

| Where | What lives here |
|---|---|
| `src/lib/format.ts` | `formatRWF` + status metadata (used across storefront and dashboard) |
| `src/lib/hooks/**` | **Client-side** React hooks: `useCart`, `useProducts` (client components only) |
| `src/types/api.ts` | The DTO contract shared between backend and frontend (`OrderDTO`, `ProductDTO`, `DashboardKpiDTO`, …) |

## TESTS

| Where | What lives here |
|---|---|
| `tests/unit/**` | Vitest unit tests (auth, dto, errors, format, orders-admin, payments, rate-limit, storefront, use-cart, validation, smoke) |
| `tests/integration/**` | Vitest integration tests (server actions, storefront flows) |
| `tests/stubs/` | Test stubs (e.g. `server-only` alias) |
| `e2e/pages/**` | Playwright page-object models (one per screen) |
| `e2e/specs/**` | Playwright end-to-end specs (11 specs: customer journeys + admin suite) |
| `e2e/global-setup.ts`, `admin-session.ts`, `data.ts` | e2e harness: DB reset/seed, owner-session bootstrap, fixtures |

## DOCS

```
docs/
├── STRUCTURE.md          # this file — the repo map
├── RUNBOOK.md            # step-by-step how-to-run (non-technical)
├── SCREENS.md            # route → owning-agent contract
├── adr/                  # architecture decision records (0001–0004 + README)
├── plans/                # build plans (MVP demo plan, storefront plan)
├── reports/              # agent summary reports + index (README.md)
├── notes/                # working notes (user/agent)
└── release-notes/        # client-facing release notes (date-named)
```

## CONFIG (root)

| File | Purpose |
|---|---|
| `package.json` / `package-lock.json` | Dependencies + scripts (dev, build, lint, test, db:migrate, db:seed) |
| `tsconfig.json` / `next-env.d.ts` | TypeScript + Next.js typing |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` / `postcss.config.mjs` | Tailwind v3 theme + CSS pipeline |
| `eslint.config.mjs` | ESLint flat config |
| `vitest.config.ts` | Vitest unit/integration harness |
| `playwright.config.ts` | Playwright e2e harness (dev server + test DB wiring) |
| `docker-compose.yml` | Postgres containers: dev (5434) + test (5435) |
| `opencode.json` | opencode default agent + skills wiring |

## AGENTS CONFIG

`.opencode/**` — the 38-agent roster (one markdown file per agent) and 22 skills (SKILL.md each). Wired via `opencode.json`. Contract files: `AGENTS.md` (working model), `docs/SCREENS.md` (route ownership). Agents never edit each other's files; `organizer` keeps this layout tidy.

---

_Ownership rule: every route has exactly one owning agent (see `docs/SCREENS.md`); shared foundations are owned by `frontend-agent` / `dashboard-agent` / `backend-agent` / `database-agent`. This map is for humans — follow the contract for edits._
