# Runner Checkpoint — 2026-08-09 notifications wave

**Verdict: PASS** (all 9 sequence steps green; 2 triage notes + 1 pre-existing latent defect surfaced — see Notes)

## Evidence

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | docker compose up -d | OK | zubeli-postgres 5434 + zubeli-postgres-test 5435 both `Up (healthy)` — 5432/5433 untouched |
| 2 | migrate status (dev 5434) | UP TO DATE, 3/3 | `20260805143802_init`, `20260809090155_slug_partial_unique`, `20260809121807_notifications` — all applied, rolled_back_at NULL, no drift (brief said 4/4; disk has exactly 3 — verified `ls prisma/migrations`) |
| 3 | lint | PASS | 0 errors, 2 known e2e warnings (CatalogPage Locator, account.spec DELIVERY_FEE_RWF) |
| 4 | tsc --noEmit | PASS | exit 0 |
| 5 | vitest | PASS | **321/321 (19 files)**, 3.96s |
| 6 | e2e | PASS | **29/29 (3.1m)** — customer 15 + admin 14; port 3000 freed by PID (974715) first, never pkill |
| 7 | Notification table on 5435 | PASS — stronger than expected | global-setup reset → table exists, **18 live rows** created by the suite itself: 8 NEW_ORDER (ZBL-…, "Bank transfer for 14,500 RWF"), 2 PAYMENT_REVIEW w/ ref E2E-BT-…, 8 LOW_STOCK — wiring proven end-to-end |
| 8 | build | PASS | `next build --turbopack`: 24 routes (21 SCREENS pages + /api/health + /api/admin/upload + /_not-found), **10 /admin/* ƒ**, 0 DYNAMIC_SERVER_USAGE, 0 action errors. ⚠ flaky — 3 of 7 attempts hit ENOENT "Cannot find module for page" (varying pages), last 4 consecutive GREEN |
| 9 | smoke (tmux `zubeli` restarted on :3000) | PASS | /api/health `{ok:true,db:"up"}` 200; / 200; /login 200; /products 200; guest /admin 307→/login?next=%2Fadmin |

Dev DB (5434) untouched by this run: **0 notifications**, 0 e2e-shaped product slugs, orders 16 / products 66 (27 active) — pre-existing demo state (prior incident cleanup still PENDING per user).

## Notes / triage

1. **Pre-existing latent defect (outside wave, not committed):** `src/app/(store)/login/page.tsx:30` exports `sanitizeNextPath` — invalid Next.js Page export. Webpack build fails deterministically on it ("does not match the required types of a Next.js Page"); Turbopack skips the check, which is why every prior checkpoint/CI (all `--turbopack`) stayed green. **Owner: account-agent** — one-line fix: drop the `export` (helper only used at line 54) or move to `src/lib/`. Recommend fixing regardless: any webpack build switch fails until then.
2. Turbopack build flakiness ("Cannot find module for page" ENOENT, varies per run) — known 15.5.22 bug class; retries green but CI can intermittently red. Recommend `build-error-resolver`/`devops-agent` evaluate a 15.5.x patch bump.
3. All storefront routes now `ƒ` (were `○` static) — the (store) layout now calls `getSession()` for the header bell wiring (wave side effect). Informational; static prerender for `/`, `/products` is gone.

Known, non-blocking: badge count/dropdown are client-side, not e2e-covered.

## Files

- No app files changed by runner (zero edits); dev server left running via tmux session `zubeli` on :3000.
- Report: docs/reports/2026-08-09-runner-checkpoint-notifications-wave.md