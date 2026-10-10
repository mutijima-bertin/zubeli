# Zubeli — Runbook (how to run and understand the project)

*Plain-language guide for the project owner. Last updated: 2026-10-05*

This guide explains what zubeli is and walks you through starting it, step by step. No programming knowledge needed — just follow the commands.

---

## What zubeli is

Zubeli is **one app** made of four parts working together:

| Part | What it does | Where to see it |
|---|---|---|
| **Storefront** | The shopping pages your customers see — browse tools, open a product, add to cart, checkout | the main site (e.g. http://localhost:3000) |
| **Dashboard** | The business area only you (the owner) use — products, stock, orders, customers, sales | http://localhost:3000/admin |
| **Backend** | The invisible "brain" — the logic that saves and loads everything (carts, orders, payments, login) | runs inside the same app, no separate server to start |
| **Database** | Storage for products, orders, customers, stock history | runs inside Docker, no setup by hand |

All four live in this one folder/repo and are started with a few simple commands.

---

## What you need before starting

1. **Node.js + npm** — the tools that run the app and its packages.
2. **Docker** — the tool that runs the database, and it must be **running** (open Docker Desktop and wait until it says "Running").

---

## Step 1 — Start the database

The database is two small containers managed by Docker.

```bash
docker compose up -d
```

This starts two Postgres databases:

| Container | Port | Purpose |
|---|---|---|
| `zubeli-postgres` | 5434 | Main database (your real data while developing) |
| `zubeli-postgres-test` | 5435 | Separate database used only by the automated tests |

Check everything is up and healthy:

```bash
docker compose ps
```

Both should show `Up` and `(healthy)`. If not, run `docker compose up -d` again (see Troubleshooting).

---

## Step 2 — Environment setup

The app reads its settings from a local file. Create it from the example:

```bash
cp .env.example .env.local
```

Then generate a secret key for login security:

```bash
openssl rand -hex 32
```

Copy the long hex string it prints, open `.env.local`, and paste it as the value of `SESSION_SECRET`.

A few things worth knowing:

- `.env.local` is where **the app** reads settings (`SESSION_SECRET`, shop phone number, bank details). It is private to your machine (gitignored) and never committed.
- A separate file at the root called `.env` already exists — it holds the database addresses and is used by the database tools (Prisma). Never commit it either.
- **Ports 5432 and 5433 belong to another project on this machine — never use them.** Zubeli's two databases are on 5434 and 5435 as shown above.

---

## Step 3 — Apply the database structure + demo data

Only needed the first time (and whenever dependencies change):

```bash
npm install
```

Then build the database structure and fill it with demo data:

```bash
npm run db:migrate    # applies the database structure ("schema")
npm run db:seed       # inserts demo data — safe to run again any time
```

Optional (careful): to wipe everything and start fresh:

```bash
npm run db:reset      # DESTRUCTIVE — deletes all data and rebuilds from zero
```

---

## Step 4 — Start the app (frontend + backend together)

It is one app, so one command:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. What you'll see:

- **Storefront** — the shop: home page, product catalog, product pages, cart, checkout.
- **Dashboard** — log in as the owner and open `/admin`: products, stock, orders, customers, sales.
- **Backend** — already running inside the app; the pages call it automatically.
- **Database** — running in Docker; it only stores what the app saves.

---

## Demo accounts (development only)

You can log in with these test accounts, which are created by the seed:

| Role | Email | Password |
|---|---|---|
| Owner (full admin) | `owner@zubeli.rw` | `DemoPass2026!` |
| Demo customer | `umutoni@demo.rw` | `DemoPass2026!` |
| Demo customer | `eric@demo.rw` | `DemoPass2026!` |

These are demo credentials — never use them in production.

---

## Demo data to test with

The seed creates a realistic demo shop:

- **30 products** across **10 categories** (some low in stock, one out of stock, one unpublished, 8 featured)
- **15 orders** spread over the last ~90 days, in several statuses
- Two orders are especially useful for the demo:

| Order | What to try |
|---|---|
| **ZBL-00000014** | A bank-transfer order (ref `TRF-8820136`), still **PENDING** — it is waiting for you to confirm the payment manually in the dashboard |
| **ZBL-00000015** | A "mobile money at the door" order — still **PENDING** |

Payments in the MVP are **Pay on Delivery** with three choices: cash at the door, mobile money (MTN MoMo / Airtel Money) at the door, or bank transfer. There is **no payment gateway yet** — the owner confirms payment manually in the dashboard (that's where order ZBL-00000014 comes in).

---

## How to check the app is healthy

```bash
curl http://localhost:3000/api/health
```

You should see:

```json
{"ok":true,"db":"up"}
```

That means the app is up **and** the database is reachable.

---

## Running the tests

| Command | What it does |
|---|---|
| `npm run test` | Unit + integration tests (Vitest) |
| `npm run test:coverage` | Same, plus a code-coverage report |
| `npm run test:e2e` | Browser "click-through" journeys with Playwright — uses the **test** database (5435) |

---

## Quality checks (do at least once before showing/sharing)

| Command | What it checks |
|---|---|
| `npm run lint` | Code style / linting (ESLint) |
| `npx tsc --noEmit` | Type errors (TypeScript) |
| `npm run build` | That a production build passes |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose ps` shows containers not healthy | Run `docker compose up -d` again; make sure Docker is running |
| Prisma says `DATABASE_URL` is missing | The database addresses live in the root `.env` (already present, never commit it) — keep secrets out of `.env.local` |
| Port 3000 already in use | The terminal will offer port 3001 — just press Enter, or run `npm run dev -- -p 3001` |
| "server-only" errors when running `npm run test` | Some files are server-only by design; Vitest needs `--conditions=react-server` (the `vitest.config.ts` covers it) |
| You want to stop the databases | `docker compose down` — stops them **but keeps data**. `docker compose down -v` — stops **and deletes** the data (destructive) |
| Change the shop phone / bank details | Edit `SHOP_MOMO_NUMBER` / `BANK_TRANSFER_DETAILS` in `.env.local` and restart `npm run dev` |

---

## Who works on what

The project is run by a team of automated agents (38 of them). Two documents explain the setup:

- **`docs/SCREENS.md`** — every page in the app and the **single agent** that owns it.
- **`AGENTS.md`** — the full roster of agents. Newest additions: `organizer` (keeps the repo clean), `runner` (starts and verifies the app), and `quality-agent` (owns the final quality review).

After every finished task, agents leave a short report in `docs/reports/` so the history is always visible.

---

## Deployment (Vercel + Neon + Blob)

This is the production setup for the online shop. It is **manual and
approval-gated** — nothing here runs automatically from a developer machine, and
agents never push or deploy.

**Chosen model (why):** Vercel's own **Git integration** builds and deploys
`main` on push. We deliberately do NOT add a GitHub Actions deploy workflow —
that would duplicate what Vercel already does and add a `VERCEL_TOKEN` to
manage. Schema migrations are the one thing Vercel does not do, so they run
separately via the manual `migrate-production` workflow (or `npm run db:deploy`
from a machine).

Stack/region: **Vercel Hobby + Neon (Marketplace) + Vercel Blob**, region
`fra1` (from `vercel.json`).

### Prerequisites
- A Vercel (Hobby) account with the repo imported.
- Node 22 + npm locally for the one-off migration/seed commands.
- Access to Neon (created through the Vercel Marketplace).

### Step 1 — Create the Neon database
1. Vercel dashboard → **Storage → Create Database → Neon**, region `fra1`
   (Frankfurt), near the Vercel functions.
2. Copy **both** connection strings from Neon:
   - **Pooled** (host contains `-pooler`) → becomes `DATABASE_URL` at runtime.
   - **Direct/unpooled** → used ONLY for migrations + the one-off seed.
3. Keep them out of the repo. If you store them, use a password manager or your
   shell — never a committed file.

### Step 2 — Attach the Blob store
1. Vercel dashboard → **Storage → Create → Blob**.
2. Attach it to the project. Vercel injects `BLOB_READ_WRITE_TOKEN`
   automatically (all environments) — do not set it by hand.
3. Vercel's filesystem is read-only; without this token, admin image upload fails.

### Step 3 — Set Vercel environment variables
Project → **Settings → Environment Variables**, Production environment:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL (`?sslmode=require`) |
| `PAYMENT_METHODS` | `COD_CASH` |
| `DEMO_MODE` | `false` |
| `TZ` | `Africa/Kigali` |
| `BCRYPT_ROUNDS` | `10` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |
| `NEXT_PUBLIC_APP_NAME` | `Zubeli` (optional; has a default) |
| `NEXT_PUBLIC_CURRENCY` | `RWF` (optional; has a default) |

`BLOB_READ_WRITE_TOKEN` is injected by Step 2. `SESSION_SECRET` is reserved —
the app does not read it (sessions are DB-backed, ADR 0002); only set it if
cookie signing is reintroduced. **Never** put the unpooled URL in `DATABASE_URL`.

Preview deployments: DISABLE them, or isolate them with Neon branching, so a
preview can never touch the production database. Hobby function limits are fine
for this demo, and Neon's free-tier compute suspends after idle and wakes on the
first request — acceptable for a demo.

### Step 4 — Apply migrations (unpooled), ONCE before the first deploy
From a machine with the repo checked out, point `DATABASE_URL` at the
**unpooled** URL for this single command:

```bash
DATABASE_URL="postgresql://<neon-direct>?sslmode=require" npm run db:deploy
```

Equivalent, approval-gated in CI: **Actions → Migrate production (manual) → Run
workflow → type `migrate`**. That workflow needs the repo secret
`DATABASE_URL_UNPOOLED` (name only — you create it). It only migrates; it never
deploys. `prisma migrate deploy` is non-destructive and forward-only; it never
resets or drops data.

### Step 5 — Seed the production taxonomy (owners + categories only)
Still against the **unpooled** URL, run the taxonomy seed once:

```bash
DATABASE_URL="postgresql://<neon-direct>?sslmode=require" \
SEED_MODE=taxonomy \
SEED_ADMIN_EMAIL="<owner-email>" SEED_ADMIN_PASSWORD="<strong-password>" \
npm run db:seed
```

This creates the owner login and the 10 categories — **no demo products or
orders**. (`SEED_ADMIN_*` are seed-only; the app never reads them at runtime.)
Add real products through the dashboard (`/admin/products`).

### Step 6 — Deploy
Push `main` (only with the user's approval). Vercel builds with `next build`
(webpack; see `vercel.json`) and deploys to `fra1`. Watch the build in the
Vercel dashboard.

### Step 7 — Post-deploy smoke (exact probes)

```bash
BASE=https://<your-domain>
curl -fsS "$BASE/api/health"                                  # {"ok":true,"db":"up"}
curl -fsS -o /dev/null -w '%{http_code}\n' "$BASE/"           # 200
curl -fsS -o /dev/null -w '%{http_code}\n' "$BASE/products"   # 200
curl -s  -o /dev/null -w '%{http_code}\n' "$BASE/admin"       # 307 -> /login?next=/admin
```

If `/api/health` is not `{ok,db:"up"}`, the database URL or the migration is
wrong — fix it before sharing the URL.

### Rollback
Use the smallest layer that fixes the problem.

1. **App rollback (fast, preferred).** Vercel dashboard → **Deployments** → pick
   the previous good deployment → **Promote to Production** (instant, no
   rebuild). CLI: `vercel rollback <deployment-url-or-id>`.
2. **Database.** Prisma migrations are **forward-only — there are no down
   migrations.** Every schema change must be additive/backward-compatible (the
   `Category.isActive` migration is the model: add with a default, stop using an
   old column before dropping it). To undo a bad data change, use **Neon →
   Branches → Restore / point-in-time restore (PITR)**. **Caveat: PITR restores
   the WHOLE database** to a timestamp — every write after that instant is lost.
   Prefer an app rollback unless the schema or data itself is wrong.

### Backups
- **Neon PITR** covers the managed database; check the retention window on your
  Neon plan. **Before any destructive migration**, create a Neon branch (an
  instant copy) or record the PITR timestamp.
- **Manual logical dump** (portable safety net):

```bash
pg_dump "postgresql://<neon-direct>?sslmode=require" -Fc -f "zubeli-$(date +%F).dump"
# restore into a fresh database:
pg_restore -d "postgresql://<target>?sslmode=require" --clean --if-exists zubeli-YYYY-MM-DD.dump
```

- Keep production dumps out of the repo and off shared drives.