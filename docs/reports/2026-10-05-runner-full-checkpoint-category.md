# Runner — Full Checkpoint (Vercel/Blob + timezone + rate-limiter + payment-allowlist + category-CRUD wave)

*2026-10-05 (session run 2026-10-06) — verdict: **PASS WITH 1 FINDING***

| # | Step | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | Infra | `docker compose ps` | `zubeli-postgres` 5434 + `zubeli-postgres-test` 5435 both **healthy**; `pg_isready` ok both | PASS |
| 2 | Migrations | `prisma migrate status` @5434 + @5435 | **6 migrations, 0 pending** on both ("schema up to date"); dev DB untouched: 43/17/10 | PASS |
| 3 | Types | `npx tsc --noEmit` | 0 errors | PASS |
| 4 | Lint | `npm run lint` | exit 0 — 0 errors, 1 known warning (`e2e/pages/CatalogPage.ts` unused `Locator`); re-run AFTER e2e artifacts existed → still clean (ESLint-artifact fix confirmed) | PASS |
| 5 | Unit ×2 | `npm test` | run1 **356/356 (21 files, 8.5s)**; run2 **356/356 (8.7s)**; 20-run soak: 18/20 green — **2 flakes in `tests/integration/admin-categories.test.ts` (runs 3, 11), see finding F1** | PASS w/ F1 |
| 6 | E2E ×2 | `E2E_BASE_URL=http://localhost:3100 npx playwright test` | run1 **31/31 passed (3.3m)**; run2 **31/31 passed (3.3m)** — server proven on 3100 (`DATABASE_URL`→5435 verified in process env); 3000 container never touched | PASS |
| 7 | Build | `npm run build` (webpack) | PASS — **27 routes** = prior 24 + `/admin/categories`, `/admin/categories/new`, `/admin/categories/[id]/edit`; **13 dynamic `/admin/*`** = prior 10 + those 3 (all ƒ) | PASS |
| 8 | Smoke (prod :3100) | curl + 1 owner login (e2e global-setup pattern) | `/api/health` **200** `{"ok":true,"db":"up"}`; `/` **200**; `/products` **200**; `/cart` **200**; `/login` **200**; `/admin` guest **307**→`/login?next=%2Fadmin`; `/admin/categories` guest **307**→`/login?next=%2Fadmin%2Fcategories`; owner: `/admin/categories` **200** (h1 "Categories"), `/admin` **200** | PASS |
| 9 | Cash-only boot | `PAYMENT_METHODS=COD_CASH npm run build` + `start` | health 200; `/checkout` renders with **`COD_CASH` input present**, `COD_MOBILE_MONEY`/`BANK_TRANSFER` **absent**; torn down after | PASS |

**Findings (owning agents):**
- **F1 — flaky test (medium), `tdd-guide`:** `tests/integration/admin-categories.test.ts` failed 2/20 full-suite runs (createCategory / deleteCategory / listAll — different test each time), 0/8 solo runs, 0/6 paired with `actions.test.ts`. Matches the race documented in the file's own header: `actions.test.ts` `TRUNCATE "Session"` runs in a parallel worker while this file's `ensureSessions()` upsert window is open → action reads no session → `ok:false`. `expectOk` masks the error code (`expect(result.ok)` throws before the informative message) — fix = assert with the error attached, then close the race (e.g. scoped DELETE instead of TRUNCATE, or re-upsert inside the action's retry). Checkpoint not held hostage: both mandated runs green.
- **Latent fragility (low), `e2e-runner`:** `admin-sales.spec.ts:30` asserts `/ZBL-[0-9]{8}/` (digits only) but UI-created orders are hex (`ZBL-[0-9A-F]{8}`); passes only while <5 hex orders precede it in Recent orders. Use shared `ORDER_NUMBER_RE` from `e2e/data.ts`.

**Runner's own environment incident (resolved, no app code touched):** first e2e attempt reused a dev server started WITHOUT `DATABASE_URL` override → suite ran against dev DB 5434 (Playwright injects the test URL only when IT launches the server), causing 1 e2e fail (admin-sales, digits-vs-hex) + dev-DB pollution (6 orders, 3 products, 3 users, 23 notifications, 26 carts, 5 sessions, 12 movements, ZBL-00000014 confirmed+fulfilled, 3 stock rows). **Surgically restored via one SQL transaction** (delta reversal): back to **43 products / 17 orders / 10 categories**, ZBL-00000014 **PENDING/PENDING**, stock 13/29/7, 0 movements today — verified after teardown. Server restarted with `DATABASE_URL`→5435; both proper e2e runs then green. Foreign `css-frontend` on 3000 up and untouched throughout.
