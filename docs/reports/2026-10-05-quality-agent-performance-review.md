# Performance review — category CRUD + Vercel/serverless wave

*2026-10-05 · performance-optimizer (read-only). No file edited except this report; baseline tsc/lint/vitest/e2e/build pre-verified, not re-run.*

Scope: route rendering mode, category query duplication, Postgres rate limiter, Blob upload, business-tz sales aggregation, admin category screens, client bundles.

## Verdicts (review items 1–7)
1. Storefront dynamic rendering — ACCEPTABLE. `cookies()` in `(store)/layout.tsx` forces dynamic; defensible because the header is per-user (session/cart/bell). Per request (guest): layout `listAll()` (2 SQL) + page data; homepage adds featured (1) and a *duplicate* `listAll()`; catalog adds listPublished + `listAll()`. ≈4–6 indexed queries, warm Neon, no measured regression. `revalidatePath` on dynamic routes only busts the client Router Cache — near-no-op, harmless.
2. Category queries — HIGH (duplication), otherwise fine. `listAll()` `select`s scalars (no over-fetch except `description`); `isActive` index unnecessary on ~10 rows.
3. Rate limiter — ACCEPTABLE on latency. Only login/register/checkout/admin-category call it; none is a hot read path. One PK upsert per limited request. Fail-open protects availability but not latency. Bucket rows are never pruned.
4. Image upload — PASS for normal clients (2 MB cap enforced before buffering); chunked-body gap MEDIUM (admin-only). Blob `remotePatterns` + `next/image` sizes/priority correct.
5. Sales aggregation — PASS: GROUP BY/parameterised in SQL, no per-row Intl. Missing `Order.createdAt` index is MEDIUM at scale.
6. Admin category list — PASS: one query + one `_count`, no per-row query; negligible.
7. Bundle/JS — PASS: correct client/server split; hand-rolled SVG icons, pure-CSS chart, lazily-imported `@vercel/blob`. `formatRWF` per-row `Intl` is MEDIUM.

## Findings (impact-ordered)
- HIGH `src/app/(store)/layout.tsx:28` + `src/lib/storefront.ts:50,108` — layout and page both call `listAll()`; on `/` and unfiltered `/products` it is the identical query twice (2× findMany + count aggregates + double RSC serialization). Fix: `React.cache` on a no-arg variant (default `={}` is a fresh object, so arg-keyed caching alone won't dedupe). Owner: backend-agent.
- MEDIUM `src/lib/format.ts:33` — `new Intl.NumberFormat` per `formatRWF` call, invoked per row in grids/tables/summaries. Fix: hoist one module-level formatter. Owner: frontend-agent.
- MEDIUM `src/lib/db/categories.ts:68` — `description` selected for storefront but unused; serialized into the client RSC payload (MobileMenu/CategoryDropdown) on every page. Fix: drop from the storefront select. Owner: backend-agent.
- MEDIUM `src/app/api/admin/upload/route.ts:57` — bodies without `content-length` (chunked) bypass the pre-check and buffer fully before `file.size`. Fix: hard body cap/edge limit. Owner: backend-agent.
- MEDIUM `prisma/schema.prisma:218` — no `@@index([createdAt])` / `@@index([status,createdAt])` on `Order`; `User.createdAt` unindexed for `newCustomerCount`. Fine at 15 rows, degrades at scale. Owner: database-agent.
- MEDIUM `prisma/schema.prisma:282` + `src/lib/rate-limit.ts:102` — RateLimitBucket rows never pruned (unbounded growth per IP/email key). Owner: backend-agent / database-agent.
- LOW `src/lib/rate-limit.ts:113` — fail-open still awaits the failing query; a short timeout race would bound added latency. Owner: backend-agent.
- INFO `src/lib/db/categories.ts:64` — no index on `isActive`; seq scan optimal at this size — no action. INFO `CategoryForm.tsx:55` slug derivation per keystroke is a cheap pure op.

Verdict: no CRITICAL. Two fixes carry the most value: dedupe `listAll()` (HIGH) and hoist the Intl formatter (MEDIUM); the rest are scale-time or admin-only.
