/**
 * Payment provider registry (ADR 0003).
 * getPaymentProvider resolves by PaymentMethod; MOMO_GATEWAY / CARD are
 * reserved enum values with NO provider in the MVP → ValidationError.
 * buildPaymentInstructions renders the customer-facing instructions for any
 * order (checkout success + account/admin order detail).
 */
import 'server-only';
import { PaymentMethod } from '@prisma/client';
import { siteConfig } from '@/lib/site';
import { ValidationError } from '@/lib/errors';
import type { PaymentInstructions } from '@/types/api';
import type { PaymentProvider } from './types';
import { BankTransferProvider, MockProvider, PayOnDeliveryProvider, mobileMoneyLines } from './providers';

const CASH_AND_MOMO_PROVIDER = new PayOnDeliveryProvider();
const BANK_PROVIDER = new BankTransferProvider();
const MOCK_PROVIDER = new MockProvider();

/**
 * Whether the configuration allowlist (`siteConfig.paymentMethods` ←
 * `PAYMENT_METHODS` env) currently offers `method`. Independent of DEMO_MODE:
 * demo mode may only change WHICH provider answers, never WHICH methods the
 * shop accepts.
 */
export function isPaymentMethodOffered(method: PaymentMethod): boolean {
  return siteConfig.paymentMethods.includes(method);
}

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  // ORDER IS LOAD-BEARING — do not reorder these two blocks.
  // 1. Allowlist first: a method the shop does not offer must never resolve to
  //    a provider, not even the demo mock. (Regression fixed 2026-10-05: demo
  //    mode used to short-circuit this check, so DEMO_MODE=true accepted every
  //    method regardless of PAYMENT_METHODS.)
  // 2. Demo mode second: it only swaps the provider for an ALREADY-ALLOWED
  //    method (mock covers all three MVP methods).
  if (!isPaymentMethodOffered(method)) {
    throw new ValidationError(
      `Payment method ${method} is not currently offered — available: ${siteConfig.paymentMethods.join(', ')}`,
    );
  }

  if (siteConfig.demoMode) return MOCK_PROVIDER;

  switch (method) {
    case PaymentMethod.COD_CASH:
    case PaymentMethod.COD_MOBILE_MONEY:
      return CASH_AND_MOMO_PROVIDER;
    case PaymentMethod.BANK_TRANSFER:
      return BANK_PROVIDER;
    case PaymentMethod.MOMO_GATEWAY:
    case PaymentMethod.CARD:
      // Unreachable: CONFIGURABLE_METHODS (src/lib/site.ts) excludes reserved
      // values, so the allowlist gate above rejects them first. Kept for
      // exhaustive typing / defense if a reserved value ever became configurable.
      throw new ValidationError(`Payment method ${method} is not available yet — reserved for future gateway integration`);
  }
}

/**
 * Canonical customer-facing payment-method label. Single source of copy for
 * the checkout UI, payment-instruction cards AND notification bodies
 * (backend-agent contract). Reserved methods throw — same as the provider
 * registry (ADR 0003).
 */
export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.COD_CASH:
      return 'Cash on delivery';
    case PaymentMethod.COD_MOBILE_MONEY:
      return 'Mobile money on delivery';
    case PaymentMethod.BANK_TRANSFER:
      return 'Bank transfer';
    case PaymentMethod.MOMO_GATEWAY:
    case PaymentMethod.CARD:
      throw new ValidationError(`Payment method ${method} is not available yet — reserved for future gateway integration`);
  }
}

/**
 * Customer-facing instructions for a placed order (ADR 0003 table).
 * `order.number` is the bank-transfer reference the customer must use.
 */
export function buildPaymentInstructions(order: { number: string }, method: PaymentMethod): PaymentInstructions {
  switch (method) {
    case PaymentMethod.COD_CASH:
      return { title: paymentMethodLabel(method), steps: ['Pay in cash when your order arrives.'] };
    case PaymentMethod.COD_MOBILE_MONEY:
      return { title: paymentMethodLabel(method), steps: mobileMoneyLines() };
    case PaymentMethod.BANK_TRANSFER: {
      const steps: string[] = [];
      const b = siteConfig.bankTransferDetails;
      steps.push(b?.raw ?? 'Ask the shop for current bank transfer details.');
      steps.push(`Use the order number ${order.number} as your transfer reference.`);
      steps.push('The owner confirms the payment manually once the transfer arrives — usually within one business day.');
      return { title: paymentMethodLabel(method), steps };
    }
    default:
      throw new ValidationError(`Payment method ${method} is not available yet`);
  }
}
