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

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  if (siteConfig.demoMode) return MOCK_PROVIDER; // demo: mock covers all three MVP methods
  switch (method) {
    case PaymentMethod.COD_CASH:
    case PaymentMethod.COD_MOBILE_MONEY:
      return CASH_AND_MOMO_PROVIDER;
    case PaymentMethod.BANK_TRANSFER:
      return BANK_PROVIDER;
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
      return { title: 'Cash on delivery', steps: ['Pay in cash when your order arrives.'] };
    case PaymentMethod.COD_MOBILE_MONEY:
      return { title: 'Mobile money on delivery', steps: mobileMoneyLines() };
    case PaymentMethod.BANK_TRANSFER: {
      const steps: string[] = [];
      const b = siteConfig.bankTransferDetails;
      steps.push(b?.raw ?? 'Ask the shop for current bank transfer details.');
      steps.push(`Use the order number ${order.number} as your transfer reference.`);
      steps.push('The owner confirms the payment manually once the transfer arrives — usually within one business day.');
      return { title: 'Bank transfer', steps };
    }
    default:
      throw new ValidationError(`Payment method ${method} is not available yet`);
  }
}
