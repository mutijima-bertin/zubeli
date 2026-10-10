# Runner — Final Full Verification Checkpoint (2026-10-05 wave)

**Verdict: BASELINE CONFIRMED — all 10 steps green, zero failures, no code fixes needed. Next.js 15.5.27.**

| # | Step | Command | Result | Status |
|---|---|---|---|---|
| 1 | Infra | `docker compose ps` | both Postgres 16 healthy; 5434/5435 reachable (3000 = other project, untouched) | PASS |
| 2 | Migrations | `npx prisma migrate status` × both DBs | 6 migrations, 0 pending; `20261005083355_category_is_active` applied on 5434 + 5435 | PASS |
| 3 | Types | `npx tsc --noEmit` | 0 errors (exit 0) | PASS |
| 4 | Lint | `npm run lint` | exit 0, 0 errors, 0 warnings | PASS |
| 5 | Unit/integration | `npm test` ×2 | run1 **22 files / 369 tests**, run2 **22 files / 369 tests** — no flake (9.5s / 10.1s) | PASS |
| 6 | E2E | `E2E_BASE_URL=http://localhost:3100 npx playwright test` ×2 | run1 **31 passed (3.7m)**, run2 **31 passed (4.3m)**; `pw:webserver HTTP GET http://localhost:3100/ → 200 ... WebServer is already available` (reused my server, never :3000) | PASS |
| 7 | Prod build | `npm run build` (webpack) | PASS — **27 routes, 13 dynamic `/admin/*`** (matches baseline) | PASS |
| 8 | Smoke | curl (prod build, :3200) | health `200 {"ok":true,"db":"up"}`; `/` `/products` `/cart` `/login` = 200; `/admin` guest `307 → /login?next=%2Fadmin`; `/admin/categories` guest `307 → login`; owner-authenticated `/admin/categories` = 200 | PASS |
| 9 | Cash-only config | `next start` with `PAYMENT_METHODS=COD_CASH` + browser | non-empty cart `/checkout` renders radios `["COD_CASH"]` ("Cash on delivery"); MoMo absent, bank-transfer absent | PASS |
| 10 | Allowlist regression | `npx vitest run tests/integration/storefront/payment-allowlist.test.ts` | 4/4 pass (rejects BANK_TRANSFER under COD_CASH + DB untouched; DEMO_MODE cannot bypass; default allows all) | PASS |

**Build route list (27):** ƒ / · ○ /_not-found · ƒ /account · /account/orders · /account/orders/[id] · ƒ /admin · /admin/categories · /admin/categories/new · /admin/categories/[id]/edit · /admin/customers · /admin/customers/[id] · /admin/orders · /admin/orders/[id] · /admin/products · /admin/products/new · /admin/products/[id]/edit · /admin/sales · /admin/stock · /api/admin/upload · /api/health · /cart · /checkout · /checkout/success · /login · /products · /products/[slug] · /register. **13 `/admin/*` dynamic** (`/_not-found` is the only static route).

**Environment notes:** host :3000 is `css-frontend` (different project) — never touched; E2E ran exclusively on my :3100 dev server (test DB 5435) and smoke on a throwaway :3200 prod server, both stopped after. Dev DB 5434 rechecked intact: **43 products / 17 orders / 10 categories / 5 users**. `npm test` and Playwright were run strictly sequentially. **Failures + owning agents: none.**
