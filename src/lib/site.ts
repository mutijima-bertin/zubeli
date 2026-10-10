/**
 * Site configuration — single reader of the storefront env block.
 * Validated at boot (module scope) per ADR 0003; server-only so bank
 * details never reach the client bundle (values flow via DTOs).
 */
import 'server-only';
import { PaymentMethod } from '@prisma/client';

export type BankTransferDetails = {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  /** Raw env string — fallback display line. */
  raw: string;
};

export type SiteConfig = {
  appName: string;
  appUrl: string;
  currency: string;
  shopMoMoNumber: string | null;
  bankTransferDetails: BankTransferDetails | null;
  /** DEMO_MODE=true registers the MockProvider (dev/seed/demo pitches, ADR 0003). */
  demoMode: boolean;
  /**
   * Payment methods the storefront OFFERS. `PAYMENT_METHODS` is a
   * comma-separated allowlist (e.g. `PAYMENT_METHODS=COD_CASH`), so production
   * can be cash-on-delivery-only and be widened later with an env change and no
   * deploy. Unknown entries are dropped; unset/empty/all-invalid falls back to
   * every MVP method so local dev and CI are unaffected.
   */
  paymentMethods: PaymentMethod[];
};

/** Every MVP method (ADR 0003) — the fallback allowlist. */
const MVP_METHODS: readonly PaymentMethod[] = [
  PaymentMethod.COD_CASH,
  PaymentMethod.COD_MOBILE_MONEY,
  PaymentMethod.BANK_TRANSFER,
];

/**
 * The ONLY values `PAYMENT_METHODS` may enable. MOMO_GATEWAY and CARD are
 * reserved for a future gateway integration (AGENTS.md, ADR 0003) and must
 * never be accepted from configuration — they have no provider and no payment
 * flow, so enabling them would let checkout place an order nobody can pay for.
 */
const CONFIGURABLE_METHODS: readonly PaymentMethod[] = MVP_METHODS;

function parseBankTransferDetails(): BankTransferDetails | null {
  const raw = process.env.BANK_TRANSFER_DETAILS;
  if (!raw) return null;
  const parts = raw.split('—').map((s) => s.trim()).filter(Boolean);
  return {
    bankName: parts[0] ?? null,
    accountName: parts[1] ?? null,
    accountNumber: parts[2] ?? null,
    raw,
  };
}

function parsePaymentMethods(): PaymentMethod[] {
  const raw = process.env.PAYMENT_METHODS;
  if (!raw) return [...MVP_METHODS];

  const values = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const methods = values.filter((v): v is PaymentMethod =>
    (CONFIGURABLE_METHODS as readonly string[]).includes(v),
  );
  const rejected = values.filter((v) => !methods.includes(v as PaymentMethod));

  if (methods.length === 0) {
    console.warn(
      `[zubeli] PAYMENT_METHODS="${raw}" contains no usable payment method — falling back to ${MVP_METHODS.join(', ')}`,
    );
    return [...MVP_METHODS];
  }
  if (rejected.length > 0) {
    console.warn(`[zubeli] PAYMENT_METHODS: ignoring unknown values — ${rejected.join(', ')}`);
  }
  return [...new Set(methods)];
}

export const siteConfig: SiteConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Zubeli',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? 'RWF',
  shopMoMoNumber: process.env.SHOP_MOMO_NUMBER ?? null,
  bankTransferDetails: parseBankTransferDetails(),
  demoMode: process.env.DEMO_MODE === 'true',
  paymentMethods: parsePaymentMethods(),
};
