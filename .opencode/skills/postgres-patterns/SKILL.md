---
name: postgres-patterns
description: "Use when designing the database schema, writing raw SQL, or optimizing queries in zubeli. Covers normalization, IDs, indexes, transactions, N+1 avoidance, pooling, and backups."
---

# Postgres Patterns

PostgreSQL practices for the zubeli database. Prisma owns migrations (see prisma-patterns); this skill covers what the schema and queries must look like underneath.

## When to use
- Schema design, index decisions, query performance work, or any raw SQL in the project.

## Core rules
- **Schema design**: 3NF by default; denormalize only for proven hot reads (e.g., cached price snapshot on order items).
  - IDs: Prisma `String` cuid/v4 or Postgres `uuid` — pick once, use everywhere. No auto-increment for public IDs (leaks order volume).
  - Every table: `id`, `createdAt`, `updatedAt`. Use `timestamptz` for all timestamps.
  - Money as integer cents (or `numeric(12,2)`); never `float`. Currency column when multi-currency becomes real.
  - Enums as Postgres enums or check constraints — keep in sync with Prisma enums.
- **Indexes**:
  - Index every FK used in joins and every column in `WHERE`/`ORDER BY` hot paths: `products(categoryId)`, `orders(status)`, `order_items(orderId)`, `orders(customerId, createdAt DESC)`.
  ```prisma
  model OrderItem { ... @@index([orderId]) @@index([productId]) }
  ```
  - Composite indexes respect column order — put equality columns first, range last.
  - Don't index low-cardinality flags you rarely filter alone. Revisit with `EXPLAIN ANALYZE`.
- **Transactions**: any multi-statement write (create order + decrement stock + create payment) must be one transaction. In Prisma use `$transaction` (see prisma-patterns). Never commit partially.
- **Avoid N+1**: batch queries; in Prisma use `include` carefully, or fetch collections per parent. Watch for N+1 in list pages (product cards with categories/images).
- Query optimization: `EXPLAIN ANALYZE` on slow queries; prefer index scans; avoid `%LIKE%` on large tables (use trigram index `pg_trgm` if search is real).
- **Connection pooling**: use `pgBouncer` (transaction mode) or Prisma Accelerate-style pooler for serverless/lambda; set sane pool size for long-running host. Never exhaust connections with per-request clients.
- **Backups**: nightly `pg_dump` (or managed backup) to off-site storage; test restore monthly. Document restore steps in runbooks. WAL archiving if RPO matters (deployment-patterns).
- Read replicas only when writes are the bottleneck — not before.
- Raw SQL allowed in migrations and complex reports only; keep it reviewed.

## Do NOT
- Do NOT use `float`/`double` for money.
- Do NOT drop old columns/indexes without a migration plan and downtime check (deployment-patterns).
- Do NOT run `DELETE`/`UPDATE` without `WHERE` in production, even "temporarily".
- Do NOT store secrets or PII unencrypted; encrypt PII at rest if required (security-review).

## Related
- prisma-patterns (migrations + queries), backend-patterns (repositories), deployment-patterns (migrations on deploy, backups). Agents: database-agent, architect, planner.
