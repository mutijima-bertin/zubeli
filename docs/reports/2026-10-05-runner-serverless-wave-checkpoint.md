# Runner Checkpoint — Serverless-Readiness Wave (2026-10-05)

*Runner: `runner` · Date: 2026-10-05 · Repo: zubeli · Next.js 15.5.22 / Prisma 6.19.3 / Postgres 16 / Node 22*

## VERDICT: **FAIL** — 1 real defect (HIGH), everything else green

`npm test` is **red**: the Postgres rate limiter loses a token under concurrency.
Proven root cause, not a flaky test. Triaged to **`backend-agent`**. Not fixed here (checkpoint, not a build task).

| # | Step | Result |
|---|---|---|
| 1 | `docker compose ps` | **PASS** — both DBs healthy |
| 2 | `prisma migrate status` (5434 + 5435) | **PASS** — 6 migrations, zero drift both DBs |
| 3 | `npx tsc --noEmit` | **PASS** — 0 errors |
| 4 | `npm run lint` | **PASS** — 0 errors, 1 pre-existing warning |
| 5 | `npm test` | **FAIL** — 337/338, 1 failed (intermittent, 2/5 full runs) |
| 6 | `npx playwright test` ×2 (default TZ, `TZ=UTC`) | **PASS** — 29/29 both runs, identical |
| 7 | `npm run build` | **PASS** — 24 routes, 10 `/admin/*` dynamic |
| 8 | Dev server + HTTP smoke | **PASS** — health 200, all pages 200, guest 307, owner 200 ×6, revenue renders |
| 9 | `git status` / env integrity | **PASS** — no new files, env md5 unchanged |

---

## FAILURE 1 (HIGH) — rate limiter loses a token under concurrency → `backend-agent`

**File:line:** `src/lib/rate-limit.ts:63-77` (the `consumeToken` upsert); secondary `src/lib/rate-limit.ts:84-88` (retry hint).
**Failing test:** `tests/integration/rate-limit.test.ts:102-109` → `expect(results.filter((r) => r.allowed)).toHaveLength(3)` got **2**.

```
FAIL tests/integration/rate-limit.test.ts > takeToken — token bucket in Postgres
     × consumes the last token exactly once under concurrency (single atomic statement)
AssertionError: expected [ { allowed: true, …(1) }, …(1) ] to have a length of 3 but got 2
 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 337 passed (338)
```

**It is a real bug, not a flaky test.** Isolated file: 8/8 pass. Full suite: **2 of 5 runs fail** — it only fires under parallel load, i.e. the exact concurrency the Postgres limiter exists to handle.

**Mechanism (proven, not inferred):** the refill term is
`FLOOR(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) * 1000 * limit / windowMs)`.
`NOW()` is `transaction_timestamp()`, fixed at transaction start, so a racing statement can reach the
`ON CONFLICT DO UPDATE` path with a `NOW()` **earlier** than the row's `updatedAt` (written by a statement
that started later but committed first). The elapsed time goes negative and **`FLOOR` of a small negative
number is `-1`**, so the "refill" *subtracts* a token. Verified in Postgres:

```
SELECT FLOOR(-0.005*1000*3/60000), FLOOR(0*1000*3/60000), FLOOR(0.005*1000*3/60000);
 floor_of_small_negative | floor_of_zero | floor_of_small_positive
-------------------------+---------------+-------------------------
                      -1 |             0 |                       0
```

Live probe of the exact statement: a bucket holding **2** tokens, one `takeToken`, returned **0** (should be 1):

```
--- seed: 2 tokens, updatedAt 5s in the FUTURE (out-of-order racing commit) ---
--- EXACT upsert from src/lib/rate-limit.ts:63-77, limit=3 window=60s ---
 remainingTokens
-----------------
               0        <-- two tokens consumed for ONE request
```

**Impact:** the limiter is *stricter* than configured — a legitimate user can be 429'd while tokens remain,
under precisely the concurrent serverless traffic this change was built for. Direction is fail-safe
(never over-permits), so this is availability/correctness, not a security hole. It also makes the suite
non-deterministic. `rate-limit.ts:84-88` shares the defect: a future `updatedAt` yields a negative
`elapsedMs` and an inflated `retryAfterSeconds`.

**Suggested direction for `backend-agent`** (not applied — not my file): clamp the elapsed interval at 0
before `FLOOR` (or use `GREATEST(0, ...)` on the refill term), and/or use a monotonic clock
(`clock_timestamp()`) instead of the transaction-scoped `NOW()`. The existing test is correct — keep it.

---

## Verbatim step output

### 1. `docker compose ps`
```
NAME                   IMAGE                COMMAND                  SERVICE                CREATED       STATUS                 PORTS
zubeli-postgres        postgres:16-alpine   "docker-entrypoint.s…"   zubeli-postgres        12 days ago   Up 3 hours (healthy)   0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
zubeli-postgres-test   postgres:16-alpine   "docker-entrypoint.s…"   zubeli-postgres-test   12 days ago   Up 3 hours (healthy)   0.0.0.0:5435->5432/tcp, [::]:5435->5432/tcp
```

### 2. `npx prisma migrate status`
```
warn The configuration property `package.json#prisma` is deprecated ... Prisma 7 ...
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "zubeli", schema "public" at "localhost:5434"
6 migrations found in prisma/migrations
Database schema is up to date!
```
Test DB (5435) identical: **6 migrations found**, `Database schema is up to date!`
> Note: the brief said "three migrations"; there are **6** on disk (`init`, `slug_partial_unique`,
> `notifications`, `remove_delivery_fee`, `rate_limit_bucket`, `category_is_active`). Latest =
> `20261005083355_category_is_active`, as stated.

### 3. `npx tsc --noEmit`
```
(no output)
=== tsc exit code: 0 ===
```

### 4. `npm run lint`
```
> zubeli@0.1.0 lint
> eslint

/home/mutijimabertin/Documents/proj/zubeli/e2e/pages/CatalogPage.ts
  1:23  warning  'Locator' is defined but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (0 errors, 1 warning)
=== lint exit code: 0 ===
```

### 5. `npm test` — FAIL
```
 ❯ tests/integration/rate-limit.test.ts (15 tests | 1 failed) 607ms
     × consumes the last token exactly once under concurrency (single atomic statement) 100ms
 ❯ tests/integration/rate-limit.test.ts:107:46
 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 337 passed (338)
   Start at  10:51:58
   Duration  4.38s (transform 2.21s, setup 6.94s, import 5.61s, tests 3.77s, environment 1.31s)
```
Flake characterisation: file alone **8/8 pass**; full suite **2 of 5 runs fail** at the same assertion.

### 6. `npx playwright test` — full suite, both storefront + admin

**Run A (machine default TZ = Africa/Kigali/CAT):** `29 passed (3.0m)` — 181s — 11 specs, 1 worker.
**Run B (`TZ=UTC`, server process verified via `/proc/<pid>/environ` → `TZ=UTC`):** `29 passed (3.1m)` — 191s — same 29.

`TZ=UTC` changed **nothing**: identical spec list, identical pass count. The timezone-explicit
`src/lib/time.ts` work holds. This was a meaningful test — the machine TZ is `Africa/Kigali` (UTC+2),
a real 2-hour offset from the `TZ=UTC` run.

Specs (all ✓ in both runs): `account`(2) `admin-customers`(2) `admin-login`(3) `admin-orders`(3)
`admin-products`(3) `admin-sales`(2) `admin-stock`(1) `auth`(5) `browse`(2) `cart`(2) `checkout`(4).

**Rate limiting did NOT break e2e login — verified, not assumed.** `global-setup` runs
`prisma migrate reset --force` per run, which wipes buckets: post-run buckets had
`oldest 10:12:46` / `newest 10:15:22`, both inside that 181s run. Post-run buckets: 8 rows
(`checkout` 4, `login` 3, `register` 1), 0 negative balances, one `login` bucket at 0 tokens
(limiter genuinely exercised; client IP `::1`). Test DB after run: 6 users / 19 orders / 45 products,
18 Notifications. Login did **not** 429 in any run.

**Negative test — `PAYMENT_METHODS=COD_CASH` (asked for in the brief):** `27 passed, 2 failed (5.0m)`.
Exactly the two specs that hardcode a disabled method, both hanging on `locator.check` (the radio is
correctly not rendered, so it cannot be checked):
- `e2e/specs/account.spec.ts:24` → `selectPayment("COD_MOBILE_MONEY")` at `e2e/specs/account.spec.ts:63`
- `e2e/specs/checkout.spec.ts:54` → `selectPayment("BANK_TRANSFER")` at `e2e/specs/checkout.spec.ts:69`

→ **triage: `e2e-runner`.** The suite is coupled to the default allowlist. Not an app bug (the app
correctly hides unavailable methods); the specs should read the configured allowlist and skip/adapt.
Keep `PAYMENT_METHODS` unset in any environment that runs e2e.

### 7. `npm run build` — PASS (webpack; `build` is now plain `next build`)
```
 ✓ Compiled successfully in 9.7s
 ✓ Generating static pages (14/14)

Route (app)                                 Size  First Load JS
┌ ƒ /                                    1.43 kB         121 kB
├ ○ /_not-found                            996 B         104 kB
├ ƒ /account                              1.2 kB         116 kB
├ ƒ /account/orders                      1.64 kB         116 kB
├ ƒ /account/orders/[id]                   202 B         112 kB
├ ƒ /admin                                 225 B         118 kB
├ ƒ /admin/customers                     3.25 kB         121 kB
├ ƒ /admin/customers/[id]                  225 B         118 kB
├ ƒ /admin/orders                        3.57 kB         119 kB
├ ƒ /admin/orders/[id]                   1.65 kB         119 kB
├ ƒ /admin/products                      4.47 kB         127 kB
├ ƒ /admin/products/[id]/edit            1.55 kB         126 kB
├ ƒ /admin/products/new                    216 B         124 kB
├ ƒ /admin/sales                           895 B         118 kB
├ ƒ /admin/stock                         5.52 kB         123 kB
├ ƒ /api/admin/upload                      124 B         103 kB
├ ƒ /api/health                            124 B         103 kB
├ ƒ /cart                                2.96 kB         123 kB
├ ƒ /checkout                            4.99 kB         125 kB
├ ƒ /checkout/success                      213 B         112 kB
├ ƒ /login                               2.04 kB         133 kB
├ ƒ /products                            4.78 kB         125 kB
├ ƒ /products/[slug]                     2.88 kB         123 kB
└ ƒ /register                            2.25 kB         133 kB
+ First Load JS shared by all             103 kB
=== build exit code: 0 ===
```
**24 routes, 10 `/admin/*` dynamic — confirmed** (all 10 `/admin/*` rows are `ƒ`).

### 8. Dev server + real HTTP smoke — PASS

> **Deviation (forced, non-destructive):** port **3000 is held by another project's Docker container
> `css-frontend`** (`jabo-frontend:latest`, `127.0.0.1:3000->3000/tcp`, cwd `/app`, Next **16.3.4**) — the
> same project whose Postgres owns 5432, which AGENTS.md says never to touch. Zubeli's default port was
> therefore unavailable. I did **not** stop it. I ran zubeli on **port 3100** via the harness's own
> `E2E_BASE_URL` + `next dev -p 3100`, which is exactly the mechanism `playwright.config.ts:57` provides.
> `reuseExistingServer: true` would otherwise have silently pointed the whole e2e suite at the foreign
> `/app` server — worth knowing before anyone runs e2e on this box.

Guest (dev DB 5434): `/api/health` → **200 `{"ok":true,"db":"up"}`** · `/` 200 · `/products` 200 ·
`/products/adjustable-wrench` 200 · `/login` 200 · `/cart` 200.
Guest `/admin` → **307 → `/login?next=%2Fadmin`** ✅.

Owner (`owner@zubeli.rw`, real form login → `zubeli_session` set, redirected to `/admin`):
`/admin` 200 · `/admin/orders` 200 · `/admin/sales` 200 · `/admin/products` 200 · `/admin/stock` 200 ·
`/admin/customers` 200 — all six.

**Revenue renders (the timezone-touched screen) — PASS, figures cross-checked against the DB.**
`/admin` KPI total **1,829,600 RWF**, AOV **140,738 RWF**. DB cross-check with
`SET TIME ZONE 'Africa/Kigali'; date_trunc('month', …)`: `sum(totalCents)` = 1,829,600 over 13
paid/fulfilled orders, and 1,829,600 / 13 = 140,738 — **exact match**. All 12 month buckets render
(Nov 2025 → Oct 2026) with values: Jun 94,000/1 · Jul 377,200/4 · Aug 295,700/5 · Sept 1,062,700/3,
rest 0; `/admin/sales` adds the period bounds `1 Oct 2026` / `31 Oct 2026`. **No crash markers**
(`Application error` / `Internal Server Error` / `__NEXT_ERROR` absent), no empty-state.
> Two false alarms I raised and then disproved myself: (a) "Jun 2026 missing" — my regex dropped it
> because the line says "1 **order**", not "orders"; (b) an apparent 100× currency bug — `src/lib/format.ts:6`
> documents "Money is integer minor units: **1 RWF = 1 unit** (ADR 0004)", so `*Cents` columns hold RWF and
> `formatRWF` correctly does not divide by 100. Neither is a defect.

Upload fallback (brief item 4) — `BLOB_READ_WRITE_TOKEN` unset in both env files, so the local path ran:
```
POST /api/admin/upload -> HTTP 200
{"ok":true,"data":{"url":"/uploads/products/3e6a9578-8082-4e65-9b7f-2bc1d0021dac.png"}}
GET /uploads/products/3e6a...png -> HTTP 200 type=image/png bytes=70
git check-ignore -v -> .gitignore:25:/public/uploads/  IGNORED
```
Real 1×1 PNG accepted by the magic-byte sniff; `/public/uploads/` stays ignored
(`.gitignore:25`). Probe file deleted afterwards; dir back to its pre-run 71 entries.
`Category.isActive` present but unfiltered — storefront `/products` returned all 10 categories, behaviour unchanged.

Dev server shut down cleanly (`SIGTERM`, port 3100 free); foreign `:3000` and both DBs untouched.

### 9. Tree + env integrity — PASS
```
md5sum .env .env.local   -> b81c0458…33af / 57d58c68…855   (identical to pre-run)
git diff --stat -- .env .env.local  -> (empty)
tracked modified/deleted: 76 pre-run  -> 76 post-run
untracked:                49 pre-run  -> 49 post-run   (identical set)
find src prisma e2e tests -newermt '-90 minutes'  -> (empty)
public/uploads/products:  71 entries  -> 71 entries
test-results/, playwright-report/  -> IGNORED
```
**No new untracked files were created by the run**, and `.env` / `.env.local` were **not modified**.
No commit, no push, no remote touched.

---

## Observations (no action taken — not defects)

1. **`RateLimitBucket` grows forever.** Rows never expire and `checkout:${ip}:${cartId}` is keyed per
   cart — one row per checkout per cart, permanently (4 rows from 4 carts in one run). Same retention
   class as the existing Notification prune backlog item. → `backend-agent` / `devops-agent` at hosting.
2. **`npm run build` infers the wrong workspace root**: it selects `/home/mutijimabertin` because a stray
   `package-lock.json` exists in `$HOME`. Harmless locally, but it can skew `outputFileTracingRoot` on a
   deploy. → `devops-agent` / `docs-writer` (remove the stray lockfile or set `outputFileTracingRoot`).
3. **e2e must not share a port with another app** (see step 8). Consider pinning `E2E_BASE_URL` in the RUNBOOK.
4. Dev DB left at its documented drifted state: 43 products / 17 orders / 5 users / 10 categories.
   Only expected smoke side-effects: `Session` 2 → 3 (my owner login), `RateLimitBucket` 0 → 1 (that login).

## Next steps
1. **`backend-agent`** — fix `src/lib/rate-limit.ts:63-77` negative-elapsed token theft; re-run `npm test` ≥5×.
2. **`e2e-runner`** — make the 2 payment-method specs respect the configured allowlist.
3. Re-run this checkpoint for a clean PASS.
4. `docs-writer` — add this report to `docs/reports/README.md` (index not edited here; `docs-writer` owns it).