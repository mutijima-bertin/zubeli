# Account-agent — Remove delivery fee from order detail

**Date:** 2026-09-22

## What was done
Removed the 2,000 RWF delivery/transport fee from the customer **order detail** page. Decision: fee eliminated entirely; order totals = subtotal only (backend `OrderDTO` already dropped `deliveryFeeCents`, `total == subtotal`).

## Files touched
- `src/app/(store)/account/orders/[id]/page.tsx` — deleted the "Delivery fee" `<dt>`/`<Price>` definition row from the **Order summary** card (was between Subtotal and Total). Subtotal + Total rows kept; existing border divider above Total preserved. Pay-on-delivery **payment instructions** left untouched (payment method, not transport). File went 241 → 235 lines.

## Grep sweep (owned routes only)
`deliveryFeeCents` / `delivery fee` / `transport fee` (all cases) across `(store)/login`, `(store)/register`, `(store)/account`: **0 matches** after the edit. Remaining occurrences live in others' scope: homepage banner, cart + checkout summaries, `/admin/orders/[id]` — untouched.

## Verification evidence
- `npx tsc --noEmit`: **0 errors in owned files**; remaining errors all in `tests/*` (drop of `deliveryFeeCents` from DTOs + `HomepageData`) — owned by tdd-guide per brief.
- `npm run lint`: **0 errors, 0 warnings in owned files**; 2 warnings in `e2e/` (incl. unused `DELIVERY_FEE_RWF` in `e2e/specs/account.spec.ts`) — owned by e2e-runner/tdd-guide.
- `git diff` shows the single removal only.

## Reviewers should look at
1. Order summary card renders Subtotal → Total directly (no fee row), border above Total intact.
2. No residual `deliveryFeeCents`/fee copy anywhere under `/account/*` or `/login`, `/register`.
3. Payment instructions (pay-on-delivery steps) unchanged; error/loading/empty states untouched.

## Next steps
`e2e/specs/account.spec.ts` still asserts the old `DELIVERY_FEE_RWF` constant — e2e-runner should update that spec; tdd-guide owns `tests/*` fixes.