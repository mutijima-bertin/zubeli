# tdd-guide — account.test fixture date fix

**Date:** 2026-08-07 · **Agent:** tdd-guide · **Status:** DONE

## What was broken
- `tests/integration/storefront/account.test.ts` `listRowFixture()` built `createdAt` from `id.slice(-1)`: for `order-9` it produced day `"010"` → Invalid Date; `order-10`/`order-11` also collided with `order-1`/`order-2`. The pagination test (11 rows) then crashed inside the DTO mapper (`iso()` → `RangeError: Invalid time value`, src/lib/dto.ts:35) → `expectOk` saw `INTERNAL`.

## What I changed
- **`tests/integration/storefront/account.test.ts` (~line 179)** — replaced the slice-arithmetic `createdAt` with a day derived from the FULL numeric portion of the id:
  - added `const n = Number(id.match(/\d+$/)?.[0] ?? 1);`
  - `createdAt: new Date(Date.UTC(2026, 7, 1 + n, 9)),` — always-valid ISO (1 + n < 32), unique per id (order-1 → day 02 … order-11 → day 12), keeps the 09:00 Z time.
- No other test in the file touched; no files under `src/` touched (production DTO mapper out of scope, confirmed correct).

## Verification evidence
- `npx vitest run tests/integration/storefront/account.test.ts` → **13 passed / 0 failed (13)** — was 1 failed / 12 skipped.
- `npx tsc --noEmit` → exit 0, 0 errors (PASS).
- `npm run lint` → 0 errors (PASS; 1 pre-existing warning in `checkout.test.ts:227`, present at HEAD — unrelated, not my file, untouched).

## Notes
- `tests/integration/storefront/account.test.ts` is untracked (part of the uncommitted tdd suite) — edit verified in working tree.
- Report index `docs/reports/README.md` is maintained by `docs-writer`; entry for this fix left for them (consistent with prior tdd reports).

## Next steps
- None blocking: storefront account integration suite green; awaiting Checkpoint 3 (runner) + quality gate.