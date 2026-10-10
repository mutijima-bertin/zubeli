# 2026-08-09 — database-agent — Notification model + migration

**Task:** add `Notification` model + `NotificationType` enum per orchestrator-pinned contract; migration to dev 5434 only. Files touched: `prisma/schema.prisma`, `prisma/migrations/20260809121807_notifications/migration.sql`.

## Schema (contract verbatim)

```prisma
enum NotificationType {
  NEW_ORDER
  PAYMENT_REVIEW
  LOW_STOCK
  ORDER_STATUS
}

model Notification {
  id        String            @id @default(cuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  body      String?
  link      String?
  readAt    DateTime?
  createdAt DateTime          @default(now())

  @@index([userId, readAt])
  @@index([userId, createdAt])
}
```
- `notifications Notification[] // onDelete: Cascade` added to `User` (mirrors `Session` convention: explicit FK scalar + inline onDelete comment).
- No `updatedAt` on Notification — per the pinned contract; append-only by design (only `readAt` mutates), documented in a schema comment.
- No seed changes: relation is optional, 0 notifications start clean.

## Migration SQL (reviewed before apply)

`20260809121807_notifications` — exactly the contract, nothing extra:
- `CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER','PAYMENT_REVIEW','LOW_STOCK','ORDER_STATUS')`
- `CREATE TABLE "Notification"` — all 8 columns as contract, PK on id
- `CREATE INDEX "Notification_userId_readAt_idx"` + `CREATE INDEX "Notification_userId_createdAt_idx"`
- FK `Notification_userId_fkey` → `User(id)` **ON DELETE CASCADE** ON UPDATE CASCADE

## Verification evidence

- `npx prisma migrate dev --create-only` → SQL reviewed → `migrate dev` applied to dev 5434; `npx prisma generate` (v6.19.3) OK
- `npx prisma migrate status` → "Database schema is up to date!" (3 migrations)
- `npx tsc --noEmit` → PASS (seed untouched; optional relation needs no seed change)
- `docker exec zubeli-postgres psql -U zubeli -d zubeli -c '\d "Notification"'` → both indices present + `FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE`

## Next steps

- Test DB 5435 schema comes automatically via e2e global-setup reset (no action needed).
- `backend-agent` can now build the notification bell: unread count via `count({ where: { userId, readAt: null } })`, list newest-first via the `[userId, createdAt]` index, mark-read/mark-all-read by flipping `readAt` (covers `[userId, readAt]` index). No schema work pending — zero seed rows by design.