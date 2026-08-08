# Runner — Stress Checkpoint (2026-08-08)

*Agent: runner — full fresh evidence after the drag-drop image feature landed*

## Result: PASS (all 10 steps green after one contamination fix — see Incident below)

## Evidence table

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Kill stray next-server | PASS | 1 stray dev server (PID 509456, dev DB) killed; port 3000 verified free (`curl` exit 7) |
| 2 | `npx tsc --noEmit` | PASS | 0 errors |
| 3 | `npm run lint` | PASS | 0 errors, 2 warnings (known e2e: `CatalogPage.ts Locator`, `account.spec.ts DELIVERY_FEE_RWF`) |
| 4 | `npx vitest run` | PASS | 264/264 tests, 15 files, 7.15s |
| 5 | `npx playwright test` | PASS | **29/29** — 11 specs, 3.2m (see per-file list) |
| 6 | `npm run build` | PASS | exit 0, 23 routes / 10 `/admin/*` ƒ; `DYNAMIC_SERVER_USAGE` = **0**; `unexpected error in action` = **0** |
| 7 | Boot smoke | PASS | `/api/health` → `{"ok":true,"db":"up"}`; `/login` 200; guest `/admin` → 307 `/login?next=%2Fadmin`; `/` 200; `/products` 200; server killed after, port 3000 left FREE |
| 8 | psql TEST DB (5435) | PASS | `mutijima@gmail.com` → **OWNER** |

## Grep counts (from full build log `/tmp/opencode/build-stress.log`)

- `grep -c "DYNAMIC_SERVER_USAGE"` → **0**
- `grep -c "unexpected error in action"` → **0**

## e2e per-file list (11 specs / 29 tests — ALL PASS)

- `specs/account.spec.ts` — 2
- `specs/admin-customers.spec.ts` — 2
- `specs/admin-login.spec.ts` — 3 (owner sign-in incl.)
- `specs/admin-orders.spec.ts` — 3 (order lifecycle incl.)
- `specs/admin-products.spec.ts` — 3 (create/edit/delete incl.)
- `specs/admin-sales.spec.ts` — 2 (overview KPIs incl.)
- `specs/admin-stock.spec.ts` — 1 (stock adjust incl.)
- `specs/auth.spec.ts` — 5
- `specs/browse.spec.ts` — 2 (home → catalog → search → filter → detail incl.)
- `specs/cart.spec.ts` — 2
- `specs/checkout.spec.ts` — 4 (COD + bank-transfer reference incl.)

## Incident log (triage, not a code bug)

First e2e run: **27/29 FAIL** (`browse` — Angle Grinder 125mm not visible on home; `admin-sales` — recent orders empty).

**Root cause — environmental:** the user's demo dev server had been restarted from its terminal (started 21:26:09) while I was killing the pre-existing one; with Playwright `reuseExistingServer: true`, the suite **reused that dev-DB server** instead of booting its own test-DB server. Everything ran against the DEV DB (5434): the admin specs wrote `E2E Drill/Hammer/Saw` products + 12 extra orders into the DEV DB, and the homepage rendered manual-test products (`sea saw`, `cement`) left in the dev DB from earlier upload-UI testing — displacing `Angle Grinder 125mm` from the featured take-8.

**Fix (runner):** killed the stray server, re-ran the suite with port 3000 free → Playwright booted its own server against the TEST DB (5435) → 29/29 PASS. GlobalSetup's reset+seed had been correct all along (test DB always had the 30/15/OWNER baseline).

**Cleanup needed by user:** the DEV DB (5434) now carries the contaminated run's leftovers — 3 `E2E *` products and ~12 extra orders (27 vs 15). Run `npm run db:reset` (destructive, dev only) before demoing, or ask database-agent to sweep them.

**Pkill footgun noted:** `pkill -f next-server`/`pkill -f "next dev"` matches its own shell command line and kills the shell (observed twice). Use exact PIDs or `ps ... | xargs kill` instead.

## Files touched

- `docs/reports/2026-08-08-runner-stress-checkpoint.md` (this report)
- No app code changed; no commits.

## Next steps

- User: relaunch demo server on :3000 (port left free); consider `npm run db:reset` for dev-DB hygiene after the contamination.
- Confirm e2e per-file evidence above for the milestone record.
