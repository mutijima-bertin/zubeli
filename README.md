# Zubeli

Rwanda construction-tools e-commerce — a **storefront** for customers plus an **owner dashboard** for managing the business. This is a demo MVP to show what the system will look like.

## What it is

- **Storefront** — customers browse construction tools, add to cart, and check out (Pay on Delivery in the MVP).
- **Owner dashboard** (`/admin`) — products, stock, orders, customers, and sales.
- Built as a single Next.js app with the database running in Docker.

## Tech stack

- Next.js 15 (React + TypeScript), Tailwind CSS
- Prisma + PostgreSQL
- Vitest (unit/integration) and Playwright (e2e) for tests

## Run it

```bash
docker compose up -d                  # 1. start Postgres (dev 5434 / test 5435)
npm run db:migrate && npm run db:seed # 2. apply schema + demo data
npm run dev                           # 3. app at http://localhost:3000
```

First time? Also run `npm install`, then copy `cp .env.example .env.local` and replace `SESSION_SECRET` with your own `openssl rand -hex 32`. **Everything else** — setup details, demo accounts, data, tests, troubleshooting — is in **[`docs/RUNBOOK.md`](docs/RUNBOOK.md)**.

## Demo credentials (dev only)

- Owner/admin: `owner@zubeli.rw` / `DemoPass2026!`
- Customers: `umutoni@demo.rw` and `eric@demo.rw` (same demo password)

## CI/CD

When this repository is pushed to GitHub, every push/PR to `main` runs the
pipeline in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Until
then the workflow file is **local-only** — it becomes live only when the
repo is pushed with explicit user approval.

What CI runs, in order (one job `verify`):

1. `npm ci` — locked install (Node 22, npm cache via setup-node)
2. `npx prisma generate` — client types needed by typecheck/build/seed
3. `npm run lint`
4. `npx tsc --noEmit` — typecheck
5. `npm test` — Vitest unit/integration suite
6. `npm run build` — production build (offline-safe: pages render
   dynamically, no DB-backed prerender)
7. `npx playwright test` — e2e against a fresh Postgres 16 service
   container on the same port contract as local (5435); the global setup
   resets + reseeds the test DB once per run; Playwright browsers and the
   Next.js build cache are cached between runs; report + traces upload on
   failure.

CI env vars / secrets (all documented in `.env.example`):

| Variable | Source | Why |
|---|---|---|
| `DATABASE_URL` | workflow env (CI postgres) | app runtime + build parity |
| `TEST_DATABASE_URL` | workflow env (CI postgres) | required by `playwright.config.ts` / global setup |
| `SESSION_SECRET` | repo secret, **safe placeholder fallback for fork PRs** | reserved — the app uses DB-backed sessions (ADR 0002) and does not read it today |

No other secrets exist. Set the `SESSION_SECRET` repo secret
(`openssl rand -hex 32`) if you want the value pinned in CI; the workflow's
deterministic fallback covers fork-preview PRs where GitHub hides secrets.

Run the same checks locally against the local Postgres:

```bash
docker compose up -d                 # dev 5434 + test 5435
cp .env.example .env.local           # then set SESSION_SECRET etc.
npm ci
npx prisma generate
npm run lint
npx tsc --noEmit
npm test
npm run build
npx playwright test                  # resets + seeds the TEST DB itself
```

Deployment is **not** automatic: CI only verifies. Building/pushing
container images and deploying to a host are documented manual steps done
at the hosting milestone — never without explicit user approval.

## Repository map

New to the repo? **[`docs/STRUCTURE.md`](docs/STRUCTURE.md)** is a one-page "where is what" map: backend (server actions + `src/lib` + `prisma`), frontend (`src/app` routes + `src/components`), shared code, tests, docs, and root config files.

## Docs

| File | What it covers |
|---|---|
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Repository map — where to find backend, frontend, database, tests, docs |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Step-by-step, non-technical guide to running the project |
| [`docs/SCREENS.md`](docs/SCREENS.md) | Every route/page and its single owning agent |
| [`docs/adr/`](docs/adr/) | Architecture decision records (0001-0004) |
| [`docs/plans/`](docs/plans/) | Build plans and roadmap |
| [`docs/reports/`](docs/reports/) | Agent summary reports (what was done, verification, next steps) |
| [`docs/release-notes/`](docs/release-notes/) | Client-facing release notes (date-named) |
| [`docs/notes/`](docs/notes/) | Working notes |
| [`AGENTS.md`](AGENTS.md) | The 38-agent roster, skills, and working model |

_Repository is local-only (no git remote); nothing is published without explicit user approval._