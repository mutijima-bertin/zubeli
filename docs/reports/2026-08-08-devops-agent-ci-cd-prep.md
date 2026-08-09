# 2026-08-08 — devops-agent: CI/CD preparation (local only)

## What was done
- **`.github/workflows/ci.yml`** (NEW, local-only): single `verify` job on push/PR to `main` — checkout → setup-node 22 (npm cache) → `npm ci` → `npx prisma generate` → lint → `npx tsc --noEmit` → `npm test` (Vitest) → `npm run build` → `npx playwright test`; Postgres 16 service container on 5435 (same port contract as `zubeli-postgres-test`); Playwright browser cache (`~/.cache/ms-playwright`) + `.next/cache` cache; upload `playwright-report/` + `test-results/` on failure; job timeout 30m (e2e step 15m — local run is ~3.2m).
- **Test-DB init**: `e2e/global-setup.ts` kept authoritative (`migrate reset --skip-seed` + `db seed` once per run) — no migrate/seed step duplicated in the workflow (documented in header).
- **Hygiene**: `.gitignore` += `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.coverage`, `coverage-ui.json`; `git rm --cached` 4 tracked artifacts from `docs/reference/ui-ux-pro-max-skill/` (2× `.pyc`, `.coverage`, `coverage-ui.json`) — files remain on disk, `.py` + `requirements.txt` kept (doc-like assets).
- **`.env.example`**: + `BCRYPT_ROUNDS`, `DEMO_MODE`, `SEED_ADMIN_2_EMAIL`, `SEED_ADMIN_2_PASSWORD`; corrected the `SESSION_SECRET` comment — the app does NOT read it (DB-backed sessions, ADR 0002, gate-listed dead env) so it is documented as reserved.
- **`README.md`**: new CI/CD section — pipeline order, env/secrets table (only `SESSION_SECRET` = secret-with-fallback; fork PRs get a safe placeholder), copy-paste local commands, "deploy is NOT automatic" note.

**CI secrets**: only `SESSION_SECRET` (secret with `||` fallback — resolved at runtime by Actions; safe for fork PRs since the app never reads it). `DATABASE_URL`/`TEST_DATABASE_URL` point at the CI service container — no secrets.

## Verification

- `npm run lint` → 0 errors (2 known e2e warnings, baseline).

- `npx tsc --noEmit` → exit 0 (no src touched).

- Workflow YAML parsed via local `js-yaml` (keys: name/on/concurrency/env/jobs; 14 steps) — no actionlint installed, manual review of `on`/jobs/services/caches/fallback expression done.

- `docker compose config` → OK (unchanged file).

- `git status`: `M .env.example, .gitignore, README.md` + 4 staged `D` (index-only) + `?? .github/`. Nothing committed, nothing pushed — push/remote creation waits for user approval.

**Follow-up for docs-writer**: `docs/RUNBOOK.md:70,74` still says the app reads `SESSION_SECRET` — inaccurate since ADR 0002; suggest rewording.

## CI FIX #1 (2026-08-09, run 31301078156 failed at Vitest)

- **Root cause**: CI postgres service container starts with an EMPTY volume, but `tests/integration/actions.test.ts` assumes the schema exists (truncates tables in `beforeAll` via its own client on `TEST_DATABASE_URL`) → P2010/42P01 `relation "Payment" does not exist` → Vitest fails, build + e2e skipped. Local 5435 carried the schema for weeks so it never surfaced.
- **Change**: `.github/workflows/ci.yml` — new step `Apply database migrations (migrate deploy)` right after "Generate Prisma client" (now step 5 of 15). `npx prisma migrate deploy` reads the job-env `DATABASE_URL` (already → `localhost:5435/zubeli_test`, same DB as `TEST_DATABASE_URL`); comment explains why deploy (non-destructive, idempotent) not reset/dev. e2e global-setup reset+seed untouched — no conflict (applied ≤ migrations).
- **Expected effect**: CI postgres provisioned before Vitest; next run should pass lint → tsc → vitest → build → e2e (locally verified equivalents: lint 0, tsc 0, 258 passed/24 skipped). YAML re-validated via js-yaml (keys + 15 steps OK); no push — local-only until user approval.