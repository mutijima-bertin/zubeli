# Database Agent — Second Admin Seed Fixture

**Date:** 2026-08-08
**Agent:** database-agent
**Task:** Add `mutijima@gmail.com` (OWNER) as a permanent seed fixture

## What was done
- `prisma/seed.ts` now seeds a second OWNER user **mutijima@gmail.com** / **Mutijima1.** (name "Mutijima Bertin"), role `Role.OWNER`, following the exact pattern of the existing owner block (upsert keyed by email, `bcrypt.hash(pw, 10)`, `update: {}`).
- New env-overridable constants `SEED_ADMIN_2_EMAIL` / `SEED_ADMIN_2_PASSWORD` (defaults above), mirroring the existing `SEED_ADMIN_*` convention.
- Summary log line now prints both owners. No schema change, no migration, no fixture values touched (orders/products/stock untouched).

## Verification (dev DB 5434 via .env; test DB 5435 never touched)
1. `npx prisma db seed` — users 9→10; `orders: 21 (created this run: 0)`, products 30, movements 91 — existing data untouched.
2. psql: `mutijima@gmail.com | OWNER | Mutijima Bertin | has_hash=t`; owner@zubeli.rw / umutoni@demo.rw / eric@demo.rw rows unchanged.
3. bcrypt compare of stored hash against `Mutijima1.` → `true` (rounds 10, same as other seed users).
4. **Second seed run → idempotent:** users still 10, exactly 1× mutijima OWNER (no duplicate), 2 total owners, orders 21 / products 30 / order items 41 identical.
5. `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors (2 pre-existing e2e warnings only). Vitest/e2e not run (checkpoint owner).

## Next steps
- Login smoke with mutijima@gmail.com/Mutijima1. can be verified by `backend-agent`/`runner` (login rate-limit is in-memory; kill stray next-server first).
