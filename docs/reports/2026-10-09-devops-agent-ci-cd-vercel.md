# 2026-10-09 — devops-agent — CI/CD for Vercel/serverless (local only)

## What was done
- **`.github/workflows/ci.yml`** (edited): stale state corrected — header now shows the real step order, the **ordering invariant** (`npm test` and Playwright must never overlap: `actions.test.ts` TRUNCATEs the shared test DB) and the real CD model (Vercel Git integration, not this file); Prisma step comment fixed (`postinstall: prisma generate` now exists; step kept idempotent); counts corrected to **Vitest 22 files/369** and **e2e 11 specs/31**.
- **Deterministic gate env**: `DEMO_MODE=false`, `PAYMENT_METHODS=COD_CASH,COD_MOBILE_MONEY,BANK_TRANSFER` (all three → widest coverage; pinning the run to COD_CASH would drop `checkout.test.ts` BANK_TRANSFER/COD_MOBILE_MONEY cases), `TZ=Africa/Kigali`. NEW **Production-config smoke** step boots `next start` cash-only and probes `/api/health`, `/`, `/products`, guest `/admin`→307 (no second e2e run). Kept Node 22, npm/Playwright/.next caches, `migrate deploy`, failure artifacts, timeouts.
- **CD model recommended & documented: Vercel's Git integration** — Vercel builds+deploys `main` on push; no custom deploy workflow (avoids a `VERCEL_TOKEN`). Migrations are the only missing piece → NEW **`.github/workflows/migrate-production.yml`** (`workflow_dispatch` only, typed `migrate` confirmation, `secrets.DATABASE_URL_UNPOOLED` **by name only**, `prisma migrate deploy`, no deploy/CLI).
- **`.env.example`**: unmissable PRODUCTION block (runtime vars set in Vercel vs seed-time vars) + footguns — `DEMO_MODE=false` mandatory (code default false), Blob token auto-injected, MoMo/bank fields unused under COD_CASH, `SEED_ADMIN_*` dev/demo seed-only, E2E port-3000-occupied → use 3100 locally (CI unaffected). Local defaults preserved.
- **`docs/RUNBOOK.md`**: appended "Deployment (Vercel + Neon + Blob)" — Neon create → pooled/unpooled URLs → Blob → Vercel env table → `db:deploy` (unpooled) → `SEED_MODE=taxonomy` seed → deploy → smoke probes → rollback (Vercel promote + Prisma forward-only + Neon PITR whole-DB caveat) → backups (`pg_dump`/PITR).

## Verification
- YAML: `js-yaml` parses both files (ci.yml keys name/on/concurrency/env/jobs, 16 steps; migrate-production on=workflow_dispatch, 4 steps); `python3 yaml.safe_load` also OK.
- Secret scan: only `secrets.SESSION_SECRET` (64-zero fallback) and `secrets.DATABASE_URL_UNPOOLED` (name only) appear; all URL literals are `localhost` dev creds or `<placeholder>`; `BLOB_READ_WRITE_TOKEN=` empty. No token/credential introduced.
- Files touched: `.github/workflows/ci.yml`, `.github/workflows/migrate-production.yml` (new), `.env.example`, `docs/RUNBOOK.md`, this report. No `src/`/`prisma/`/`tests/`/`e2e/` edits; no commit, no push, no remote/secret creation; app/tests/docker/migrations NOT run.

## Next steps
- User: create the GitHub Environment `production` (required reviewers) + secret `DATABASE_URL_UNPOOLED` if using the manual migrate workflow; import the repo in Vercel and set env per runbook. Then approve the first push/deploy.
- `docs-writer`: add this report to `docs/reports/README.md` (index intentionally not touched — owned by docs-writer).
