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