# 2026-08-06 — runner — foundation checkpoint 1 (Phase A storefront foundation)

Checkpoint gate for the Phase A storefront foundation (frontend-agent). Full stack booted and verified on the dev DB (5434); no destructive resets; nothing published.

## Result table

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Docker | PASS | `docker compose ps`: zubeli-postgres (5434) + zubeli-postgres-test (5435) both `Up 21 hours (healthy)`. No touch of 5432/5433. |
| 2 | Migrate | PASS | `npx prisma migrate status` → "1 migration found … Database schema is up to date!" |
| 3 | Seed | PASS | `docker compose exec zubeli-postgres psql -U zubeli -tAc "SELECT count(*)...` → products=30, orders=15, categories=10, users=3 (idempotent data intact; no re-seed needed) |
| 4 | `npx tsc --noEmit` | PASS | exit 0, no output |
| 5 | `npm run lint` | PASS | exit 0, no findings |
| 6 | vitest (full) | FAIL (pre-existing, tdd-guide) | `npx vitest run` → 27 failed (119 total). All in tdd-guide's UNCOMMITTED suites — see triage. |
| 6b | vitest (foundation scope) | PASS | `npx vitest run tests/unit/format.test.ts tests/unit/smoke.test.ts tests/unit/errors.test.ts tests/unit/rate-limit.test.ts` → 42/42 passed (10+2+18+12) |
| 7 | `npm run build` | PASS | `next build --turbopack` → Compiled successfully in 22.1s, 5/5 static pages, route table OK (`/` ƒ, `/api/health` ƒ). Transient failure on first attempt = Google Fonts `Geist` fetch timeout (ext slow); retry green — network latency, not app code. |
| 8 | Boot `npm run dev` | PASS | Ready in 2.3s, no compile errors |
| 9 | `GET /` | PASS | 200 in 25.4s (first-request Turbopack compile). HTML carries storefront chrome (brand "Zubeli", meta "Construction Tools in Rwanda", ~96 KB). |
| 10 | `GET /api/health` | PASS | `200` → `{"ok":true,"db":"up"}` |
| 11 | `GET /products` | PASS (404, expected) | No route yet (catalog-agent Phase B) — proper Next 404, no crash |
| 12 | `GET /cart` | PASS (404, expected) | No route yet (cart-agent Phase B) — proper Next 404, no crash |
| — | Kill dev | ok | `pkill next dev/next-server`; port 3000 free. Note: one leftover `next dev` (pre-session, PID 398902) was found running and holding `.next/`; killed before clean build+reboot. |

## Triage (the one real failure — pre-existing, NOT this checkpoint's scope)

Full `npx vitest run` fails at load in **tdd-guide's uncommitted suites** (`tests/unit`, `tests/integration`):
1. `Error: This module cannot be imported from a Client Component module` — `server-only`'s throwing index resolves because the react-server condition is NOT honored under Vite 8 `configLoader: 'native'`. Affected: `auth.test.ts`, `dto.test.ts`, `orders-admin.test.ts`, `payments.test.ts` (4 suites fail at load) + `tests/integration/actions.test.ts` (24 tests, same root cause) + `cond-debug.test.ts` (1 — their own probe of this issue).
2. `--conditions=react-server` CLI flag is REJECTED: `CACError: Unknown option --conditions` (Vitest 4.1.10). So that workaround does not run either — matches frontend-agent's flag.
3. Also 2 assertion failures in `validation.test.ts` (tests execute, then fail): `registerSchema …accepts a valid registration…` and `loginSchema …accepts valid credentials` — `safeParse(...).success` is false for the given fixtures (expected after schema evolution).

Who/how: **tdd-guide** — try `configLoader: "bundle"` in `vitest.config.ts` (do NOT add `"type":"module"` — app-level) or alias `server-only` → empty stub, and re-check their validation fixtures against the current zod schemas. Not a foundation blocker; all foundation-owned tests pass.

Also flagged (non-blocking, from prior reports): `ProductCardDTO` lacks `lowStockThreshold` → ProductCard uses stock ≤ 5 heuristic → **database-agent** to extend the card select/DTO.

## Notes
- Prisma CLI read root `.env` correctly; Next runtime read `.env.local` (Environments line shows both).
- Durations: first requests slow due to cold Turbopack compile; steady-state quick.
- Files touched: none (runner is read-only).