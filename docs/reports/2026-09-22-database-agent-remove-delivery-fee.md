# 2026-09-22 — database-agent: remove delivery fee

## What was done
Removed the flat transport/delivery fee from the database layer per the 2026-09-22 decision.

## Files changed (allowed scope only)
- `prisma/schema.prisma` — dropped `deliveryFeeCents Int` from `Order` (~line 203); `totalCents` comment now "equals subtotalCents (no delivery line in the MVP)".
- `prisma/seed.ts` — removed `DELIVERY_FEE_CENTS` const (line ~20) + its doc comment (line ~13); removed `const deliveryFeeCents = DELIVERY_FEE_CENTS;` and the `deliveryFeeCents,` field from the Order create; `totalCents = subtotalCents`. Payment `amountCents: totalCents` now equals the new (fee-free) total.
- `prisma/migrations/20260922131646_remove_delivery_fee/migration.sql` — NEW migration:
  ```sql
  -- AlterTable
  ALTER TABLE "Order" DROP COLUMN "deliveryFeeCents";
  ```
- Uncommitted 2026-08-09 wave changes (slug partial index migration 20260809090155, notifications 20260809121807, Notification model, etc.) preserved untouched. The pre-existing `-- CreateEnum` whitespace tweak in `20260805143802_init/migration.sql` was NOT touched by me.

## Drift / reset
`prisma migrate dev` detected the init migration was modified after apply (pre-existing wave tweak) and demanded a reset. Ran `npx prisma migrate reset --force` (dev 5434, throwaway — intended). First reset's seed step failed (mid-state: DB still had NOT NULL `deliveryFeeCents`, seed already stopped providing it) — harmless. Then `npx prisma migrate dev --name remove_delivery_fee` created + applied the migration cleanly; `npx prisma db seed` reseeded 42 products / 15 orders.

## Verification (commands + results)
- `npx prisma validate` — schema valid.
- `npx tsc --noEmit --skipLibCheck --esModuleInterop --module commonjs --moduleResolution node prisma/seed.ts` — SEED TYPECHECK OK.
- `npx prisma migrate status` — "Database schema is up to date!" (4 migrations, none pending).
- info_schema query via generated client — `deliveryFeeCents` column: 0 rows (dropped).
- `SELECT ... FROM "Order" WHERE "totalCents" <> "subtotalCents"` — 0 mismatches.
- payment join `amountCents <> totalCents` — 0 mismatches; sample: ZBL-00000001 subtotal 94000 / total 94000 / payment 94000.
- `npx prisma db seed` — full run green (15 orders, 15 payments).

## Seed order-total shape (pre → post)
- Pre: `totalCents = subtotalCents + DELIVERY_FEE_CENTS(2000)`; payment `amountCents = totalCents` (incl. fee).
- Post: `totalCents = subtotalCents`; payment `amountCents = totalCents` (= subtotal). Seeded totals dropped by 2000 RWF each.

## Backend-agent needs to know
`src/*` still references `deliveryFeeCents` / `DELIVERY_FEE_CENTS` in 8 places (not my scope — prisma-only allowed): `src/app/admin/orders/[id]/page.tsx:147`, `src/app/(store)/page.tsx:28` (DeliveryBanner), `src/app/(store)/checkout/_components/SuccessScreen.tsx:100`, `OrderSummaryPanel.tsx:69`, `src/app/(store)/cart/_components/OrderSummary.tsx:33`, `src/app/(store)/account/orders/[id]/page.tsx:167`, `src/app/(store)/_components/DeliveryBanner.tsx:9,21`. The regenerated client no longer exposes `order.deliveryFeeCents`/`cart.deliveryFeeCents`, so project-wide `tsc` and the affected screens will fail until backend-agent/owners remove those (checkout order-total math too). Full suite/buildup left to runner per scope.