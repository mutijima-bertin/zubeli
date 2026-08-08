# e2e-runner — Milestone 4 e2e suite (Phase D)

*2026-08-07 · e2e-runner · docs/reports/2026-08-07-e2e-runner-milestone4.md*

## What was done
First real e2e suite for the critical customer journeys — 5 specs / **15 tests** in `e2e/`, PO-model style, running against a freshly reset+seeded test DB (5435) on each run. All mutations go through the UI (server actions are Flight-signed; no direct calls).

## Files touched (all under e2e/)
- `e2e/data.ts` — shared fixtures (products, KIGALI_ADDRESS, uniqueEmail/uniqueBankReference, ORDER_NUMBER_RE, MoMo copy RE)
- `e2e/pages/` — 11 PO models: Home, Catalog, Product, Cart, Checkout, Success, Login, Register, Account, OrderHistory, OrderDetail
- `e2e/specs/` — browse (2), cart (2), checkout (4), account (2), auth (5)
- Removed `e2e/pages/.gitkeep` + `e2e/specs/.gitkeep` placeholders

## Verification evidence
- `npx tsc --noEmit` → 0 errors (e2e files are in the app tsconfig)
- `npx playwright test` → **14 passed / 1 failed** (2.1m, chromium, serial single-DB)
- Traces on failure: `test-results/specs-account-.../trace.zip` (retain-on-failure)

## The 1 failure — APP BUG, handed to account-agent
`e2e/specs/account.spec.ts:25` — register → empty history → MoMo order → history → **detail**. Order history lists the order correctly; the detail page shows "Couldn't load this order — Something went wrong."

- **File:line:** `src/actions/account.ts:48` — `revalidatePath(\`/account/orders/${order.id}\`)` inside `getMyOrderAction`
- **Evidence (server console during run):** `Server Error: Route /account/orders/[id] used "revalidatePath /account/orders/<id>" during render which is unsupported. To ensure revalidation is performed consistently it must always happen outside of renders and cached functions.`
- **Expected vs actual:** opening your own order should render the order detail (number, items, payment, timeline); actual = INTERNAL error state.
- **Mechanism:** the action revalidates the exact route being re-rendered after the action → Next 15.5 throws inside the action → `toActionResult` → INTERNAL → error alert. (Pre-flagged as quality backlog "revalidatePath-on-read account.ts:48".) `createOrderAction` is unaffected because it revalidates *other* routes (`/cart`, `/`).
- **Suggested fix:** delete the line — the page is dynamic and re-renders per request; no cache to purge.
- Test intentionally kept failing until fixed (no weakening).

## Notes for future runs
- **Stray dev servers accumulate the in-memory register rate limit (5/h/IP):** repeated runs against a leftover server caused a false register failure. Kill leftovers (`pkill -f next-server`) before each run; CI boot is fresh so unaffected.
- Payment radio accessible name = full option label; match via `input[name="paymentMethod"][value=…]`.
- Bank-transfer success copy is `Use the order number ZBL-… as your transfer reference.` (not the customer reference).

## Next steps
1. account-agent fixes `account.ts:48` → re-run `account.spec.ts` (expect 2/2).
2. Full green run → quality gate on the e2e suite → admin journeys (Phase E) later.
