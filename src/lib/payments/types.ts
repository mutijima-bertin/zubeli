/**
 * Payment provider abstraction (ADR 0003 / payment-integration skill).
 * Checkout only talks to the interface — a future MTN MoMo / Airtel gateway
 * is a pure add: implement PaymentProvider, register it, add a webhook route.
 * No card data ever touches the app in any path (PCI-DSS basics).
 */
import type { PaymentMethod } from '@prisma/client';

export type PaymentRequest = {
  orderId: string;
  method: PaymentMethod;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  customerName?: string;
  /** Required for BANK_TRANSFER — the customer's transfer reference (ADR 0003). */
  bankTransferReference?: string;
};

/** Displayed verbatim on the checkout confirmation and order pages (ADR 0003). */
export type PaymentInstruction = {
  title: string;
  lines: string[];
};

export type PaymentIntent = {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed';
  instructions: PaymentInstruction[];
};

/** Reserved for the future gateway webhook path — never fired in the MVP. */
export type PaymentEvent = {
  type: 'payment.confirmed';
  orderId: string;
  paymentId: string;
  providerRef: string | null;
};

export type RefundResult = {
  providerRef: string | null;
  /** MVP refunds are manual (owner returns cash / transfers back) — ADR 0003. */
  note: string;
};

export interface PaymentProvider {
  createPayment(request: PaymentRequest): Promise<PaymentIntent>;
  /** Reserved: MVP providers reject with ValidationError. */
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;
  refund(paymentId: string, amountCents: number): Promise<RefundResult>;
}
