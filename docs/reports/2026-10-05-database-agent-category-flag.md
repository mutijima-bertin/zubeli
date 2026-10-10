# 2026-10-05 — database-agent — category-flag

What was done:
- Added ONE field to `model Category`: `isActive Boolean @default(true)`, placed after `description` (before `createdAt`) with an inline `//` comment matching the file's style. No `deletedAt`, no indexes, no other model touched.
- Created + applied migration `20261005083355_category_is_active` — purely additive: `ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;`
- `prisma/seed.ts` needed NO change (verified, not assumed): its `upsert({ where: { slug }, update: {} })` never writes `isActive`, so the DB default covers creates and the hidden state survives a reseed.
- Storefront category reads NOT touched (owned by the parallel agent; `src/` mtimes unchanged by me).

Files touched:
- prisma/schema.prisma (1 line added), prisma/migrations/20261005083355_category_is_active/migration.sql (new), this report.

Verification:
- `npx prisma migrate status`: 6 migrations found, "Database schema is up to date!" (zero drift). Test DB 5435 also 6/6 with the column present.
- Migration SQL verbatim: `-- AlterTable` / `ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;` (no drops, no rewrites, default present).
- `npx prisma generate`: ✔ Generated Prisma Client (v6.19.3). `npm run lint`: 0 errors, 1 pre-existing warning (e2e/pages/CatalogPage.ts unused Locator).
- Scratch DB `zubeli_scratch_catflag` (created on the 5434 instance, migrated, seeded, then DROPPED): `Category` = 10, `WHERE "isActive" = true` = 10, false = 0, NULL = 0. Re-ran the seed with one category hidden → stayed hidden (active=9, hidden=1) ⇒ reseed-safe. `SEED_MODE=taxonomy` also fine.
- Dev DB 5434 left as found: Category=10, Product=43, Order=17, OrderItem=41, User=5 (identical to the pre-change snapshot; only the new column was added). No `migrate reset`, no dev-DB seed.
- `npm test`: first run 321 passed / 3 failed — all 3 in `tests/integration/actions.test.ts`, RATE_LIMITED. Root cause: durable bucket `register:203.0.113.7` at tokens=0 left over in the test DB by the 2026-10-05 rate-limit wave (pre-existing, unrelated to this change). After `DELETE FROM "RateLimitBucket"` on 5435 only: **19 files / 324 tests passed, 324/324**.

Next steps / hand-offs:
- `tdd-guide` (blocking tsc, not mine to edit): 4 fixtures typed as the Prisma `Category` model now miss `isActive` — add `isActive: true` at `tests/unit/dto.test.ts:54` (`categoryFixture`), `tests/integration/storefront/cart.test.ts:147`, `tests/integration/storefront/checkout.test.ts:250`, `tests/unit/storefront.test.ts:315` (nested `category`). `src/` is clean; vitest passes regardless (no typecheck at runtime).
- `backend-agent`: the flag is a plain boolean column, default `true` — filter storefront/dashboard category reads with `where: { isActive: true }`; no DTO/serialization change needed unless you want it on `CategoryDTO`.
- Carry-forward: durable `RateLimitBucket` rows never expire on their own — the limiter's TTL prune needs a housekeeping job (same family as the notifications-retention backlog item), or test runs go red with RATE_LIMITED.