# 2026-08-07 backend-agent — checkout order action

## What was done
Added `getCheckoutOrderAction` to `src/actions/checkout.ts` (Decision A, storefront-build-plan) so the guest checkout success page can render order data without auth.

## Contract
- Signature: `export async function getCheckoutOrderAction(input: unknown): Promise<ActionResult<CheckoutResult>>`
- Input: `{ orderId: string }` — validated via existing `orderIdSchema` (`src/lib/validation/orders.ts`); no new schema, no new types.
- Success: `{ ok: true, data: { order: OrderDTO, paymentInstructions: PaymentInstructions } }` — identical shape to `createOrderAction` (same `toOrderDTO` + `buildPaymentInstructions` path as `getMyOrderAction`, minus the auth).
- Errors (via `toActionResult`): invalid/missing id → `VALIDATION`; unknown id → `NotFoundError('Order not found')` → `{ code: 'NOT_FOUND', message }`.
- No auth, no rate limit (matches sibling read `getCheckoutCartAction`; per-IP limiter would 429 legitimate success-page refreshes).

## Files touched
- `src/actions/checkout.ts` (only owned file; reused existing `orderIdSchema`, `getOrderById`, `buildPaymentInstructions`, `toOrderDTO`).

## Leakage check
`getOrderById` returns the customer relation, but `toOrderDTO` maps only snapshot fields (name/phone/email/address) that `createOrderAction` already returns to the same page; `bankTransferReference` exposure unchanged from today's success shape.

## Verification
- `npx tsc --noEmit` — clean (0 errors).
- `npm run lint` — clean (0 errors).
- No dev server started; no tests added (tdd-guide covers at Checkpoint 3).

## Next steps
`checkout-agent` can now call `getCheckoutOrderAction` from the success screen using the order id from `createOrderAction`'s response (sessionStorage or URL param as per screen plan).
