/**
 * MVP payment providers (ADR 0003). All are instruction-only — no gateway
 * calls, no network. The DB Payment row is created inside the checkout
 * transaction by the order repo; providers only produce the display
 * instructions the customer sees.
 */
import { PaymentMethod } from '@prisma/client';
import { siteConfig } from '@/lib/site';
import { ValidationError } from '@/lib/errors';
import type { PaymentEvent, PaymentIntent, PaymentProvider, PaymentRequest, RefundResult } from './types';

export function mobileMoneyLines(): string[] {
  const lines: string[] = [];
  if (siteConfig.shopMoMoNumber) {
    lines.push(`Pay at the door via MTN MoMo or Airtel Money to ${siteConfig.shopMoMoNumber}.`);
  } else {
    lines.push('Pay at the door via MTN MoMo or Airtel Money when your order arrives.');
  }
  lines.push('Have the MoMo confirmation code ready for the delivery agent.');
  return lines;
}

function webhookNotSupported(provider: string): Promise<PaymentEvent> {
  throw new ValidationError(`Webhooks are not supported for ${provider} in the MVP`);
}

/** COD_CASH + COD_MOBILE_MONEY — instructions only, payment happens at the door. */
export class PayOnDeliveryProvider implements PaymentProvider {
  async createPayment(request: PaymentRequest): Promise<PaymentIntent> {
    const instructions =
      request.method === PaymentMethod.COD_MOBILE_MONEY
        ? [{ title: 'Mobile money on delivery', lines: mobileMoneyLines() }]
        : [{ title: 'Cash on delivery', lines: ['Pay in cash when your order arrives.'] }];
    return { paymentId: `cod-${request.orderId}`, status: 'pending', instructions };
  }

  verifyWebhook(): Promise<PaymentEvent> {
    return webhookNotSupported('PayOnDeliveryProvider');
  }

  async refund(): Promise<RefundResult> {
    return { providerRef: null, note: 'manual refund — owner returns cash or transfers manually' };
  }
}

/** BANK_TRANSFER — the customer's reference is REQUIRED; owner verifies manually. */
export class BankTransferProvider implements PaymentProvider {
  async createPayment(request: PaymentRequest): Promise<PaymentIntent> {
    if (!request.bankTransferReference) {
      throw new ValidationError('bankTransferReference is required for bank transfer payments');
    }
    const lines: string[] = [];
    const b = siteConfig.bankTransferDetails;
    lines.push(b?.raw ?? 'Ask the shop for current bank transfer details.');
    lines.push(`Use reference ${request.bankTransferReference} on your transfer.`);
    lines.push('The owner confirms the payment manually once the transfer arrives — usually within one business day.');
    return { paymentId: `bank-${request.orderId}`, status: 'pending', instructions: [{ title: 'Bank transfer', lines }] };
  }

  verifyWebhook(): Promise<PaymentEvent> {
    return webhookNotSupported('BankTransferProvider');
  }

  async refund(): Promise<RefundResult> {
    return { providerRef: null, note: 'manual refund — owner transfers back manually' };
  }
}

/**
 * Test/demo provider (ADR 0003): mirrors the real instructions for all three
 * MVP methods. Registered only when DEMO_MODE=true (never in production).
 * Exported for unit tests regardless of env.
 */
export class MockProvider implements PaymentProvider {
  async createPayment(request: PaymentRequest): Promise<PaymentIntent> {
    const real =
      request.method === PaymentMethod.BANK_TRANSFER ? new BankTransferProvider() : new PayOnDeliveryProvider();
    return real.createPayment(request);
  }

  async verifyWebhook(): Promise<PaymentEvent> {
    return { type: 'payment.confirmed', orderId: 'mock-order', paymentId: 'mock-payment', providerRef: 'mock' };
  }

  async refund(): Promise<RefundResult> {
    return { providerRef: 'mock', note: 'mock refund' };
  }
}
