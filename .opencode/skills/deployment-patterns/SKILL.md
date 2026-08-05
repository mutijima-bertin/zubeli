---
name: deployment-patterns
description: "Use when deploying zubeli, configuring environments, or setting up CI/CD. Covers env separation, build pipeline, health checks, migrations on deploy, zero-downtime, backups, rollback, and monitoring."
---

# Deployment Patterns

Release and operations for zubeli: how code moves from dev to prod safely.

## When to use
- Setting up or modifying CI/CD, environments, deployment scripts, or monitoring; planning a release.

## Core rules
- **Environments**: dev, staging, prod — isolated databases and env vars. Staging mirrors prod (same branch, migrations first, seeded demo data). Never point staging at prod DB.
- **Env vars**: all config through environment (`.env.local` dev, secret manager in prod). Distinguish build-time (`NEXT_PUBLIC_*`, safe to ship) from runtime (server-only). No secrets in the repo or Docker image (docker-patterns).
- **Build pipeline stages** (CI):
  1. Lint + typecheck (`tsc --noEmit`)
  2. Unit/integration tests (vitest)
  3. E2E against staging (e2e-testing)
  4. `prisma migrate deploy` + `prisma generate`
  5. Build (`next build`) with `DATABASE_URL` etc. available
  6. Image build + push, then deploy
  - Fail the pipeline on any red stage; require green to reach prod.
- **Migrations on deploy**: run `prisma migrate deploy` as an explicit step before the app boots — never inside the app process at startup. Additive migrations first, then code; destructive changes planned and reviewed (postgres-patterns).
- **Zero-downtime strategy**: multiple instances behind a load balancer with rolling deploys; or Vercel-style atomic deployments. Health check: `GET /api/health` returns 200 only when DB reachable (`prisma.$queryRaw` ping). Drain old instances before cutoff.
- **Backups**: automated nightly DB backups + WAL archiving; verify restores monthly (postgres-patterns). Back up uploaded product images too.
- **Rollback plan**: every release tagged (`v*`), previous image/commit retained; rollback = redeploy previous tag + (if needed) revert migration with documented reverse step. Practice rollback on staging before go-live.
- **Monitoring basics**: uptime check on `/api/health`; error tracking (e.g., Sentry) wired into Next (`instrumentation.ts` / error boundary); request/DB latency alerts; disk and backup-success alerts. Logs centralized (request id + action name, backend-patterns).
- **Incidents**: on-call page for checkout/payment failure (highest blast radius); runbook references in repo `docs/`.
- **Release checklist** (run every release): CI green on the release branch → migrations applied on staging → smoke test critical journeys (e2e-testing) → migrate deploy → deploy app → health check passes → watch error rate for 10 minutes.
- Version everything deployable (app image `vX.Y.Z`, migrations, docs/API.md) so a release is reproducible from a tag alone.

## Do NOT
- Do NOT deploy without green CI or an explicit, documented exception.
- Do NOT run destructive migrations automatically — gate them on manual approval.
- Do NOT store secrets in Docker images, build args for runtime secrets, or client bundles.
- Do NOT skip the health check or deploy to prod on a Friday evening without a rollback ready.

## Related
- docker-patterns (image build, compose), postgres-patterns (backups), e2e-testing (CI), security-review (secrets). Agents: orchestrator, architect, planner.
