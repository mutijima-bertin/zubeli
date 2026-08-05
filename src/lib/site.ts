/**
 * Site configuration — single reader of the storefront env block.
 * Validated at boot (module scope) per ADR 0003; server-only so delivery
 * fee / bank details never reach the client bundle (values flow via DTOs).
 */
import 'server-only';

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
  /** Parsed from DELIVERY_FEE_CENTS; validated non-negative integer. */
  deliveryFeeCents: number;
  shopMoMoNumber: string | null;
  bankTransferDetails: BankTransferDetails | null;
  /** DEMO_MODE=true registers the MockProvider (dev/seed/demo pitches, ADR 0003). */
  demoMode: boolean;
};

function parseDeliveryFeeCents(): number {
  const raw = process.env.DELIVERY_FEE_CENTS;
  if (!raw) return 2000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid DELIVERY_FEE_CENTS "${raw}" — must be a non-negative integer`);
  }
  return n;
}

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

export const siteConfig: SiteConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Zubeli',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? 'RWF',
  deliveryFeeCents: parseDeliveryFeeCents(),
  shopMoMoNumber: process.env.SHOP_MOMO_NUMBER ?? null,
  bankTransferDetails: parseBankTransferDetails(),
  demoMode: process.env.DEMO_MODE === 'true',
};
