-- ---------------------------------------------------------------------------
-- Product.slug: replace the full unique index with a PARTIAL unique index
-- so that soft-deleted rows (deletedAt IS NOT NULL) do not block slug reuse
-- when an admin re-creates a product with the same slug.
--
-- Prisma generates `String @unique` as a plain unique INDEX on Postgres
-- (verified: "Product_slug_key" is an index, not a CONSTRAINT — pg_constraint
-- has no row for it, pg_indexes does). Hence DROP INDEX, not DROP CONSTRAINT.
-- Prisma cannot express partial indexes in schema syntax (see schema.prisma
-- comment on Product.slug) — this raw migration owns the constraint.
-- ---------------------------------------------------------------------------
DROP INDEX "Product_slug_key";

CREATE UNIQUE INDEX "Product_slug_active_key" ON "Product"("slug") WHERE "deletedAt" IS NULL;