# Database agent — Product slug partial unique index (2026-08-09)

## What was done
Fixed the soft-delete slug-reuse bug at the DATABASE layer: Product.slug no longer has a full unique index; uniqueness is now enforced only among **active** rows (`deletedAt IS NULL`). Admin re-creating a product whose slug matches a soft-deleted row no longer hits P2002.

## Files touched
- `prisma/schema.prisma` — `slug String @unique` → `slug String` + comment documenting that the partial unique index is owned by raw SQL (migration 20260809090155_slug_partial_unique); no `@@index` on slug (Prisma cannot express predicates).
- `prisma/migrations/20260809090155_slug_partial_unique/migration.sql` — NEW, exact SQL:
  ```sql
  DROP INDEX "Product_slug_key";
  CREATE UNIQUE INDEX "Product_slug_active_key" ON "Product"("slug") WHERE "deletedAt" IS NULL;
  ```
- `prisma/seed.ts` — tsc fallout (NOT initial scope): removing `@unique` drops `slug` from `ProductWhereUniqueInput`; seed used `upsert/update({ where: { slug } })` at lines 306/476 → rewrote as `findFirst` + `update/create({ where: { id } })`; stock pass uses the existing `productIdBySlug` map. Same idempotent semantics (findFirst also matches soft-deleted rows, like the old upsert did).
- `prisma/migrations/migration_lock.toml` — untouched (no change needed).

## Deviation from brief (intentional, verified)
The brief said `ALTER TABLE "Product" DROP CONSTRAINT "Product_slug_key"` — but Prisma-on-Postgres creates `@unique` as a plain **unique INDEX** (verified: 0 rows in `pg_constraint` for it; present in `pg_indexes`). `DROP INDEX "Product_slug_key"` is the correct statement; `DROP CONSTRAINT` would error.

## Verification evidence
- Applied with `npx prisma migrate dev` — "Your database is now in sync with your schema" (Prisma 6 diff does NOT flag the partial index as drift; nothing extra generated). `npx prisma generate` re-ran automatically + once explicitly.
- psql `pg_indexes`: `CREATE UNIQUE INDEX "Product_slug_active_key" ON public."Product" USING btree (slug) WHERE ("deletedAt" IS NULL)`; `Product_slug_key` gone; `Product_categoryId_idx` + pkey intact.
- Probe (transaction, rolled back): insert with soft-deleted slug `safety-vest` → `INSERT 0 1` SUCCESS; counter-probe with live slug `cement-50kg` → rejected `duplicate key value violates unique constraint "Product_slug_active_key"` (partial index still guards actives).
- Prisma-level probe (`npx tsx` scratch, deleted after): `prisma.product.create` reusing soft-deleted slug `measuring-tape` → OK, no P2002; probe row deleted; dev DB back to 43 products / 39 soft-deleted, 0 probe rows.
- `npx tsc --noEmit` PASS; `npx eslint prisma/seed.ts` PASS; seed rewrite runtime-verified idempotent on test DB 5435 (0 orders created this run, 42 stock rows updated); `npx prisma migrate status` = up to date.

## For backend-agent
Separate task (per brief): friendly pre-check/errors for duplicate slug on create — the DB layer (partial index) and seed compile fix are done here. Note: `ProductWhereUniqueInput` no longer contains `slug` — code must use `findFirst({ where: { slug } })` (already the pattern in src/lib/db/products.ts).