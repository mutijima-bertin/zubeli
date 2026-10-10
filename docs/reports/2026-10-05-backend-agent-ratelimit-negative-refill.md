# Rate limiter — negative-elapsed refill bug (spurious 429s)

*Date: 2026-10-05 · agent: backend-agent*

## What was done
Clamped the refill term at zero with `GREATEST(0, …)` in `src/lib/rate-limit.ts:82`. `NOW()` is
transaction-scoped, so a statement waiting on the row lock can reach `ON CONFLICT` with a `NOW()`
EARLIER than the `updatedAt` its predecessor committed; elapsed goes slightly negative and
`FLOOR(-0.005*1000*limit/windowMs)` = **-1**, so the refill term SUBTRACTED a token. Live-probed
on PG 16: unclamped `-1`, clamped `0`. Clamped build is interpolated once into the `DO UPDATE SET`
(`tokens`), the `updatedAt` CASE and the `WHERE` gate, so the SET and WHERE cannot disagree.
Atomicity untouched: still ONE `INSERT … ON CONFLICT … WHERE` statement, no in-process locking.

## Files touched (nothing else)
- `src/lib/rate-limit.ts` — one-line SQL change + comment
- `tests/integration/rate-limit.test.ts` — regression test + `pushForward()` helper

## Verification evidence
- **Regression test is meaningful:** with `GREATEST` removed it FAILS `expected { allowed: false,
  retryAfterSeconds: 62 } to deeply equal { allowed: true, retryAfterSeconds: 0 }` — a valid token
  wrongly blocked. Restored fix → 16/16 pass. Restored byte-identical (`diff -q`).
- **Live probe, TEST db 5435 only** (`zubeli_test`, dev 5434 never touched): 2-token bucket +
  future `updatedAt` → **0** pre-fix / **1** post-fix; last-token bucket → **0 rows (429)** pre-fix
  / **1 row** post-fix.
- **`npm test` x10 consecutive (5 + 5): every run `20 passed (20)` files / `339 passed (339)`
  tests, 0 FAIL.** 2 of 5 runs failed before.
- `npx tsc --noEmit` → 0 errors. Real-source `npx eslint src tests e2e prisma *.config.ts` →
  0 errors (1 pre-existing warning, `e2e/pages/CatalogPage.ts`).
- Invariants re-checked: `RATE_LIMITS` unchanged (login 10/15min, register 5/1h, checkout 10/1h);
  `takeToken`/`assertRateLimit`/`withRateLimit` still async `{ allowed, retryAfterSeconds }`;
  `RateLimitError`→429 intact; FAIL OPEN intact; blocked path `retryAfterSeconds >= 1`
  (`Math.max(1, …)`); balance never negative (`WHERE refilled >= 1` ⇒ `SET >= 0`); the seconds→ms
  `* 1000` scaling present in the single place the expression exists.

## Could not do / notes
- `npm run lint` (bare) exits 1: ESLint scans `playwright-report/` (gitignored Playwright trace
  assets, 3028 problems) because `eslint.config.mjs` `ignores` omits it. Pre-existing, NOT my
  files, not fixed here — needs the config owner to add `playwright-report/**`.
- No commit made (publishing guardrail; the wave is uncommitted on disk).

## Next steps
Not committed — needs user approval. Recommend adding `playwright-report/**` to the ESLint ignores.