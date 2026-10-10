# Security review — serverless/Vercel + category CRUD wave (2026-10-05)

Reviewer: quality-agent (security-reviewer role) · READ-ONLY · surface: uncommitted working tree on `main` (nothing staged/pushed).
Evidence: file inspection + `npm audit --omit=dev`; baseline suites not re-run; no DB/build touched.

## Findings
- **CRITICAL** `package.json:28` — Next.js `15.5.22` is in the vulnerable range for unauthenticated RCE via the Image Optimization API (AVIF) and self-hosted SSG/ISR cache poisoning (`npm audit`: 8 vulns — 1 critical, 7 high: postcss, sharp, source-map-js, nanoid, deepmerge-ts). Image Optimization is active (`next.config.ts` remotePatterns) so the AVIF RCE is reachable. Fix: bump `next` to >=15.5.27 (+ transitive). Owner: `devops-agent`.
- **HIGH** `src/lib/orders.ts:68-82` — the payment allowlist is enforced AFTER `createOrder` has already persisted the order + payment, decremented stock and cleared the cart; `getPaymentProvider` rejects a disabled method only afterwards (`src/lib/payments/index.ts:27-31`). With `PAYMENT_METHODS=COD_CASH`, a tampered `BANK_TRANSFER`/`COD_MOBILE_MONEY` POST still creates an order (idempotencyKey = cart id means a retry returns it). Fix: validate the allowlist before `createOrder`. Owner: `backend-agent`.
- **MEDIUM** `src/lib/payments/index.ts:21` — `demoMode` short-circuits before the allowlist check, so `DEMO_MODE=true` silently disables server-side allowlist enforcement. Owner: `backend-agent`.
- **MEDIUM** `src/lib/rate-limit.ts` + `prisma/schema.prisma:282` — the schema comment claims stale buckets are pruned, but no prune/TTL exists; login key is `login:${ip}:${email}` (`src/actions/auth.ts:45`) with attacker-chosen email → unbounded `RateLimitBucket` rows (storage exhaustion). Owner: `backend-agent` (+ `devops-agent` prune job).
- **LOW** `src/lib/request.ts:14` — rate-limit IP trusts the first `x-forwarded-for` hop; on non-Vercel hosts behind an XFF-appending proxy a client can rotate it to farm buckets. Prefer `x-real-ip`/last hop. Owner: `backend-agent`.
- **LOW** `next.config.ts` — no CSP/HSTS/security headers configured (defense-in-depth). Owner: `devops-agent`.
- **INFO** `.env.example` ships demo seed creds (`owner@zubeli.rw`/`DemoPass2026!`, `mutijima@gmail.com`/`Mutijima1.`) — demo-only, pre-existing; override/rotate before production.

## A–F verdicts
- **A Blob upload: CLEAN.** OWNER guard before body (`api/admin/upload/route.ts:45`), MIME + extension + magic-byte + 2 MB cap (`route.ts:76-89`), UUID + MIME-derived ext with zero client path input (`uploads-store.ts:49-66`), Blob `contentType` from the sniffed type (`:58`), token server-only (`:17`) and never echoed to the client.
- **B Payment allowlist: NOT CLEAN.** `CARD`/`MOMO_GATEWAY` are correctly rejected at zod (`validation/checkout.ts:23`), but `BANK_TRANSFER`/`COD_MOBILE_MONEY` are rejected only after persistence — see HIGH.
- **C Category actions: CLEAN.** All four call `requireAdminOrThrow` first via `guardCategoryMutation` (`actions/admin/categories.ts:27-29,42,54,67,79`); zod strips unknown keys and validates every field; no IDOR (global categories, owner-gated); error details curated (no raw Prisma/SQL).
- **D Rate limiter: acceptable with caveats.** Fail-open only on DB error (`rate-limit.ts:110-118`); keys combine IP + identity (`auth.ts:26,45`, `checkout.ts:39`); `retryAfterSeconds` not attacker-controlled. Caveats: no prune (MEDIUM) and spoofable XFF (LOW).
- **E Secrets: CLEAN.** Only `.env.example` tracked; no `BLOB_READ_WRITE_TOKEN` value; `.vercel/` ignored (`.gitignore:9`); seed credentials never imported by `src/`; `NEXT_PUBLIC_*` limited to name/url/currency.
- **F Migration: SAFE.** `ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT true` (`migration.sql:2`) is a non-rewriting constant default (PG11+); brief catalog lock only, existing rows become `true`; cannot blank rows.
