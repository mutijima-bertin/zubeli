# ADR 0003 — Payment Abstraction (Pay-on-Delivery MVP, Gateway-Ready)

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** architect (per AGENTS.md "Decided 2026-08-05")
- **Related:** ADR 0001 (Payment/Order schema, lifecycle), ADR 0004 (error contract)

## Context

MVP payments are Pay-on-Delivery with three customer options: cash at delivery, mobile money at the door, or bank transfer verified **manually** by the owner in the dashboard. The client has not paid the builder yet — this is a demo. A real MTN MoMo / Airtel Money gateway (or cards) will be integrated after the contract is signed, so the abstraction must make the gateway a **drop-in later** without touching order logic (payment-integration skill).

## Decision

### Provider interface (from payment-integration skill, implemented in `src/lib/payments/provider.ts`)

```ts
interface PaymentProvider {
  createPayment(req: PaymentRequest): Promise<PaymentIntent>;
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>; // reserved
  refund(paymentId: string, amountCents: number): Promise<RefundResult>;
}
```

- `PaymentRequest = { orderId, method, amountCents, currency, idempotencyKey, customerName? }`
- `PaymentIntent = { paymentId, status, instructions: PaymentInstruction[] }` where `PaymentInstruction = { title, lines: string[] }` — displayed verbatim on the checkout confirmation and order pages.
- Checkout code (and only checkout code) resolves a provider via the registry and calls `createPayment`. Order/stock logic never knows which provider ran.

### Registry: `getPaymentProvider(method: PaymentMethod): PaymentProvider`

| `PaymentMethod` | Provider (MVP) |
|---|---|
| `COD_CASH` | `PayOnDeliveryProvider` |
| `COD_MOBILE_MONEY` | `PayOnDeliveryProvider` |
| `BANK_TRANSFER` | `BankTransferProvider` |
| `MOMO_GATEWAY`, `CARD` | **not registered** → `ValidationError` (reserved values; AGENTS.md says integration is deferred until contract signed) |

- `MockProvider` additionally covers `COD_CASH` / `COD_MOBILE_MONEY` / `BANK_TRANSFER` when `DEMO_MODE=true` (dev/seed/demo) — lets the owner confirm instantly while pitching. Production never registers it.
- Provider config comes from env only (`SHOP_MOMO_NUMBER`, `SHOP_MOMO_NAME`, `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `DEMO_MODE`), validated at boot (never committed; git-workflow).

### Payment instructions per method (what the customer sees)

| Method | Instructions returned by `createPayment` |
|---|---|
| `COD_CASH` | "Pay in cash on delivery." (no extra steps) |
| `COD_MOBILE_MONEY` | Shop MoMo name + number (env) + "Pay at the door when your order arrives." |
| `BANK_TRANSFER` | Bank name, account name, account number (env) + **REQUIRED reference: the order number** (`Order.number`, shown to the customer) — owner matches the transfer by this reference. |

### Manual confirmation flow (the only path PENDING → PAID in the MVP)

- Owner-only server action `confirmOrderPayment(orderId)`:
  1. `requireAdmin()`, fetch order + payment, zod-validate input.
  2. If `method === BANK_TRANSFER`, the order **must** have a non-empty `bankTransferReference` (customer enters it at checkout; zod: required, min 4 chars) — otherwise `ValidationError`. The dashboard shows the customer's reference + the order number the transfer should carry.
  3. Validate transition `PENDING → PAID` via `transitionOrder()` (ADR 0001) — else `InvalidTransitionError`.
  4. One `$transaction`: `Payment.status = PAID`, `confirmedBy = owner.id`, `confirmedAt = now`, `Order.status = PAID`, `paidAt = now`. No stock movement (stock already decremented at checkout).
- Other owner actions (same pattern, all via `transitionOrder()`): `cancelOrder` (`PENDING → CANCELLED`, **restocks** via `IN/CANCEL` movement), `fulfillOrder` (`PAID → FULFILLED`, sets `fulfilledAt`), `refundOrder` (`PAID → REFUNDED`, sets `Payment.status = REFUNDED`; **no auto-restock** — returns are manual `ADJUSTMENT`).
- Nothing client-side can change order or payment status — the customer's success page only reads.

### Idempotency — one checkout per cart

- Checkout action carries `idempotencyKey = cart.id`; `Order.idempotencyKey @unique` (ADR 0001). Double-submit (double-click, retry) finds the existing order and returns it instead of double-charging or double-decrementing.
- The whole checkout is one `$transaction`: create `Order` (+ snapshot fields, `deliveryFeeCents` snapshot), create `OrderItem`s (price snapshots), create `Payment`, decrement `Product.stockQty`, write `OUT/ORDER` movements, clear the cart. Any failure rolls back everything (prisma-patterns).

### Reserved slots for the future gateway (must exist now, no-op in MVP)

- `MOMO_GATEWAY` / `CARD` enum values (ADR 0001) — no provider registered in the MVP registry.
- `verifyWebhook(rawBody, signature)` is on the interface; MVP providers return a typed rejection (`ValidationError` "webhooks not supported for this provider"). Future gateway: add `MomoGatewayProvider`, register it, add `POST /api/v1/webhooks/momo` route handler with **signature verification + idempotent processing** (`providerPaymentId @unique` in DB) — no order-logic changes. Webhooks are the *only* second path for `PENDING → PAID` (AGENTS.md).
- `refund(paymentId, amountCents)` exists on the interface; MVP providers return `{ providerRef: null, note: "manual refund — owner returns cash / transfers manually" }` — the DB status change is the record.
- PCI-DSS: no card data ever touches the app in any path (no PAN/CVV fields, logs, or storage — payment-integration skill). Mobile-money gateway data arrives only via signature-verified webhook later.

## Consequences

- **Good:** order logic is provider-agnostic; the MoMo/Airtel contract signing is a pure add (enum value already there, interface already there, webhook slot already there); manual verification fits the offline reality (owner confirms after seeing bank statement / MoMo message); demo mode makes the pitch work end-to-end.
- **Trade-offs:** owner must manually confirm every bank transfer (accepted — MVP); no gateway auto-confirmation means `PAID` lags reality by human time; in-memory rate limiting protects checkout per instance only (ADR 0002).

## Schema impact (for database-agent)

Covered by ADR 0001: `Payment` (`orderId @unique`, `method`, `status`, `confirmedBy?`, `confirmedAt?`, `providerPaymentId?`), `Order` (`bankTransferReference?`, `idempotencyKey? @unique`, `paidAt?`, `status`). No payment schema changes when the gateway lands — only a provider + webhook handler.

---

## Superseded 2026-09-22 — no `deliveryFeeCents` snapshot in checkout

The checkout-transaction step above ("create `Order` (+ snapshot fields, `deliveryFeeCents` snapshot)") is **superseded**: the flat delivery fee was removed by the user on 2026-09-22 (see the superseded note in ADR 0001). The checkout still snapshots order fields in one `$transaction`, but there is no delivery fee — `Order.totalCents == Order.subtotalCents` and `Payment.amountCents` equals that subtotal. Transport is coordinated off-app with the customer.
