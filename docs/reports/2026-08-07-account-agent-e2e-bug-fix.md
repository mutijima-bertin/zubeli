# 2026-08-07 account-agent — E2E Bug Fix (account.ts:48 revalidatePath)

## What was done
- Deleted the `revalidatePath(`/account/orders/${order.id}`)` line inside `getMyOrderAction` in `src/actions/account.ts` (it revalidated the exact route being re-rendered after the action → Next 15.5 "revalidatePath during render is unsupported" → `toActionResult` → INTERNAL → order detail "Couldn't load this order").
- Also removed the now-unused `import { revalidatePath } from 'next/cache';` (its only usage in the file was the deleted line; leaving it would produce a lint warning). Nothing else changed — no other lines, no other files.

## Files touched
- `src/actions/account.ts` (2 lines: deleted revalidatePath call + dead import)

## Verification evidence
- `npx tsc --noEmit` → exit 0, no errors.
- `npm run lint` → 0 errors; `src/actions/account.ts` no longer flagged. Remaining 2 warnings are pre-existing in e2e-runner's untracked WIP files (`e2e/pages/CatalogPage.ts` unused `Locator`, `e2e/specs/account.spec.ts` unused `DELIVERY_FEE_RWF`) — out of my scope.
- `npx playwright test e2e/specs/account.spec.ts` → **2 passed (45.7s)**: (1) register → empty history → mobile-money order → history → order detail (previously failing, now green), (2) guest cart persists after registering.
- Pre-run hygiene: killed stray `next-server` (in-memory register rate limit), Docker 5434/5435 healthy, test DB reseeded by global-setup. Removed stale generated `playwright-report/` dir (gitignored artifact from the failed M4 run) that was polluting lint; regenerated automatically on any future failure.

## Next steps
- Full e2e suite re-run (runner) for 15/15 green; quality gate e2e; then Phase E admin journeys.
