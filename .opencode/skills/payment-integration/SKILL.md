---
name: payment-integration
description: "Use when designing or implementing checkout payments (provider TBD, keep agnostic): secure checkout flow, order status lifecycle, a pluggable payment-provider abstraction, idempotency keys, webhook verification, refunds, and PCI-DSS basics."
---

# Payment Integration

## When to use
Use when building checkout, payment processing, webhooks, or refunds in the
zubeli backend. The provider is undecided (mobile money / cards / pay-on-
delivery) — code must stay provider-agnostic behind one interface.

## Core rules
- Order status lifecycle: `PENDING` (checkout started) -> `PAID` (payment
  confirmed) -> `FULFILLED` (shipped/delivered), plus `CANCELLED` and
  `REFUNDED`. Only the payment-confirmation event moves PENDING -> PAID;
  never auto-flip on redirect from the gateway.
- Provider abstraction: one `PaymentProvider` interface with pluggable
  implementations (MobileMoneyProvider, CardProvider, PayOnDeliveryProvider).
  Checkout only talks to the interface — swap or add providers without
  touching order logic.
  ```ts
  interface PaymentProvider {
    createPayment(req: PaymentRequest): Promise<PaymentIntent>;
    verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;
    refund(paymentId: string, amountCents: number): Promise<RefundResult>;
  }
  ```
- Money: integers in minor units (cents), never floats; currency stored with
  the amount; config via env, validated at boot.
- Idempotency: client sends an idempotency key (cart/order id) on
  create/confirm/refund; store it unique-indexed; repeated requests return
  the original result instead of double-charging.
- Webhooks: always verify signatures with the provider's key (constant-time
  compare); process idempotently (`paymentId` unique in DB); acknowledge
  quickly with 2xx and process async; never trust the client — re-check
  status with the provider for high-value orders.
- Refunds: full or partial, recorded as ledger entries with reason; show
  REFUNDED status to customer and dashboard.
- PCI-DSS basics: never store, log, or transmit raw PAN/CVV — card data goes
  straight to the provider (tokenized or hosted fields); CVV never persisted;
  avoid recording card data in app logs, error messages, or the DB.
- Security: secrets (API keys, webhook secrets) in env only; never commit
  them; require auth + CSRF for payment endpoints; rate-limit checkout.

## Do NOT
- Do not mark orders paid from client-side success pages — only verified
  webhooks/provider confirmation.
- Do not accept webhooks without signature verification.
- Do not store raw card numbers or CVV anywhere.
- Do not hardcode provider credentials in code or commit them.
- Do not add a second provider until the abstraction interface is stable.

## Related
`git-workflow` (never commit secrets), `content-writing` (payment/policy
copy), `marketing-campaign` (pay-on-delivery as conversion lever).
