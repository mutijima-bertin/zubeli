---
name: prisma-patterns
description: "Use when modeling the schema, writing migrations, seeding, or querying the DB via Prisma in zubeli. Covers relations, enums, migrate dev, seeding, include vs select, transactions, and pitfalls."
---

# Prisma Patterns

Prisma ORM conventions for zubeli (PostgreSQL). Schema is the single source of truth; migrations are committed and never edited by hand.

## When to use
- Editing `prisma/schema.prisma`, running `prisma migrate`, writing seeds, or any DB access in code.

## Core rules
- **Schema modeling**:
  - Model names PascalCase singular (`Product`, `OrderItem`), fields camelCase, relations explicit on both sides.
  - Enums for statuses (`OrderStatus`, `PaymentStatus`, `InventoryStatus`) — change enums via new migration, never in-place on prod.
  - Defaults: `@default(cuid())` for IDs, `@default(now())` for `createdAt`, `@updatedAt` for `updatedAt`.
  - Money as `Int` cents. Soft delete via `deletedAt` where history matters (products, users).
  - `@@index` for FKs and hot query paths — align with postgres-patterns.
- **Migration workflow**: `npx prisma migrate dev --name <slug>` locally (creates migration + applies + regenerates client). Never edit applied migration files — write a new one.
  - Production: `prisma migrate deploy` as part of the deploy pipeline (deployment-patterns), before app start.
- **Seeding**: `prisma/seed.ts` with `npx prisma db seed`. Idempotent (upsert) so it can run repeatedly; realistic construction-tool catalog + demo customer + demo admin. Run against dev/staging only — never against prod data.
- **Query patterns**:
  - Prefer `select` over `include` to limit payload (N+1, PII exposure). Use `include` only when you need the whole relation.
  - Transactions: `prisma.$transaction(async (tx) => { ... })` for stock decrement + order creation. Use the `tx` client inside; interactive transactions for conditional logic.
  - `upsert` for cart line increments, seeds, and session sync. Unique constraints required for upsert lookup fields.
  - Use `createMany`/bulk `updateMany` for batch ops (seed, bulk stock update).
- **Client generation**: regenerate client after every schema change (`prisma generate` runs with `migrate dev`; run manually in CI if needed). Type changes surface only after generate — stale client = "field does not exist" errors.
- **DateTime handling**: Prisma returns `Date` objects — they are not serializable over the wire. Map to ISO strings (`toISOString()`) at the boundary (backend-patterns, api-design).
- Wrap the client: repositories in `src/lib/db` export typed functions; app code imports repositories, not `PrismaClient` directly (DI via backend-patterns).
- Prisma errors: catch `PrismaClientKnownRequestError` (e.g., `P2002` unique violation → 409; `P2025` record not found → 404) and map to typed errors.

## Do NOT
- Do NOT edit applied migrations.
- Do NOT `prisma db push` in production as a substitute for migrations.
- Do NOT include relations you don't render.
- Do NOT instantiate `PrismaClient` per request — single shared instance (global in dev) with a connection pool.

## Related
- postgres-patterns (indexes, transactions, raw SQL), backend-patterns (repositories, errors), api-design (serialization), tdd-workflow. Agents: database-agent, backend-agent, inventory-agent, stock-agent.
