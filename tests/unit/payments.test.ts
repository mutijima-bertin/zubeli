/**
 * Payment provider abstraction (src/lib/payments/*, ADR 0003):
 * - getPaymentProvider: COD_CASH/COD_MOBILE_MONEY → PayOnDeliveryProvider,
 *   BANK_TRANSFER → BankTransferProvider, reserved MOMO_GATEWAY/CARD → ValidationError
 * - buildPaymentInstructions: title + steps per method (order.number is the
 *   bank-transfer reference)
 * - Providers are instruction-only; BankTransferProvider requires the reference;
 *   MockProvider mirrors the real providers and fakes webhook/refund.
 * siteConfig values are pinned in tests/setup.ts (deterministic MoMo number,
 * bank details, DEMO_MODE=false).
 */
import { describe, expect, it, vi } from "vitest";
import { PaymentMethod } from "@prisma/client";
import {
  BankTransferProvider,
  MockProvider,
  PayOnDeliveryProvider,
  mobileMoneyLines,
} from "@/lib/payments/providers";
import { buildPaymentInstructions, getPaymentProvider } from "@/lib/payments";
import { ValidationError } from "@/lib/errors";
import type { PaymentRequest } from "@/lib/payments/types";

const SHOP_MOMO = "+250700000000";
const BANK_DETAILS_RAW = "Bank of Kigali—Zubeli Company Ltd—1001001001";

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    orderId: "order-1",
    method: PaymentMethod.COD_CASH,
    amountCents: 32000,
    currency: "RWF",
    idempotencyKey: "cart-1",
    customerName: "Umutoni Alice",
    ...overrides,
  };
}

describe("getPaymentProvider (registry)", () => {
  it("resolves PayOnDeliveryProvider for COD_CASH and COD_MOBILE_MONEY", () => {
    expect(getPaymentProvider(PaymentMethod.COD_CASH)).toBeInstanceOf(PayOnDeliveryProvider);
    expect(getPaymentProvider(PaymentMethod.COD_MOBILE_MONEY)).toBeInstanceOf(PayOnDeliveryProvider);
  });

  it("resolves BankTransferProvider for BANK_TRANSFER", () => {
    expect(getPaymentProvider(PaymentMethod.BANK_TRANSFER)).toBeInstanceOf(BankTransferProvider);
  });

  it("throws ValidationError for the reserved MOMO_GATEWAY and CARD methods", () => {
    expect(() => getPaymentProvider(PaymentMethod.MOMO_GATEWAY)).toThrow(ValidationError);
    expect(() => getPaymentProvider(PaymentMethod.CARD)).toThrow(ValidationError);
  });
});

describe("PayOnDeliveryProvider", () => {
  it("COD_CASH → pending intent with cash instructions", async () => {
    const intent = await new PayOnDeliveryProvider().createPayment(request({ method: PaymentMethod.COD_CASH }));
    expect(intent.status).toBe("pending");
    expect(intent.paymentId).toBe("cod-order-1");
    expect(intent.instructions).toEqual([
      { title: "Cash on delivery", lines: ["Pay in cash when your order arrives."] },
    ]);
  });

  it("COD_MOBILE_MONEY → pending intent with MoMo lines including the shop number", async () => {
    const intent = await new PayOnDeliveryProvider().createPayment(request({ method: PaymentMethod.COD_MOBILE_MONEY }));
    expect(intent.status).toBe("pending");
    expect(intent.paymentId).toBe("cod-order-1");
    const lines = intent.instructions[0]!.lines;
    expect(lines[0]).toContain(SHOP_MOMO);
    expect(lines.join(" ")).toContain("MTN MoMo or Airtel Money");
  });

  it("rejects webhooks in the MVP (ValidationError) and refunds manually", async () => {
    const provider = new PayOnDeliveryProvider();
    // verifyWebhook is a sync-throwing helper (non-async) — assert via thunk.
    expect(() => provider.verifyWebhook()).toThrow(ValidationError);
    await expect(provider.refund()).resolves.toEqual({
      providerRef: null,
      note: "manual refund — owner returns cash or transfers manually",
    });
  });
});

describe("BankTransferProvider", () => {
  it("requires bankTransferReference — throws ValidationError without it", async () => {
    await expect(new BankTransferProvider().createPayment(request({ method: PaymentMethod.BANK_TRANSFER }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("builds instructions with the bank details and the customer reference", async () => {
    const intent = await new BankTransferProvider().createPayment(
      request({ method: PaymentMethod.BANK_TRANSFER, bankTransferReference: "TRF-8820136" }),
    );
    expect(intent.status).toBe("pending");
    expect(intent.paymentId).toBe("bank-order-1");
    const lines = intent.instructions[0]!.lines;
    expect(lines[0]).toBe(BANK_DETAILS_RAW);
    expect(lines).toContain("Use reference TRF-8820136 on your transfer.");
    expect(lines.some((l) => l.includes("confirms the payment manually"))).toBe(true);
  });

  it("rejects webhooks and refunds manually", async () => {
    const provider = new BankTransferProvider();
    // verifyWebhook is a sync-throwing helper (non-async) — assert via thunk.
    expect(() => provider.verifyWebhook()).toThrow(ValidationError);
    await expect(provider.refund()).resolves.toEqual({
      providerRef: null,
      note: "manual refund — owner transfers back manually",
    });
  });
});

describe("MockProvider (demo mode)", () => {
  it("mirrors the real provider instructions for each MVP method", async () => {
    const provider = new MockProvider();
    const cash = await provider.createPayment(request({ method: PaymentMethod.COD_CASH }));
    expect(cash.instructions[0]!.title).toBe("Cash on delivery");
    const bank = await provider.createPayment(
      request({ method: PaymentMethod.BANK_TRANSFER, bankTransferReference: "TRF-1" }),
    );
    expect(bank.instructions[0]!.title).toBe("Bank transfer");
    // mirrors the reference requirement too
    await expect(
      provider.createPayment(request({ method: PaymentMethod.BANK_TRANSFER })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fakes the webhook event and refund", async () => {
    const provider = new MockProvider();
    await expect(provider.verifyWebhook()).resolves.toEqual({
      type: "payment.confirmed",
      orderId: "mock-order",
      paymentId: "mock-payment",
      providerRef: "mock",
    });
    await expect(provider.refund()).resolves.toEqual({ providerRef: "mock", note: "mock refund" });
  });
});

describe("getPaymentProvider in demo mode (DEMO_MODE=true)", () => {
  it("returns the MockProvider, which answers webhooks instead of rejecting", async () => {
    const previous = process.env.DEMO_MODE;
    try {
      process.env.DEMO_MODE = "true";
      // fresh module registry so siteConfig re-reads DEMO_MODE at import
      vi.resetModules();
      const { getPaymentProvider: gpp } = await import("@/lib/payments");
      const provider = gpp(PaymentMethod.COD_CASH);
      await expect(provider.verifyWebhook("{}", "sig")).resolves.toMatchObject({ type: "payment.confirmed" });
    } finally {
      process.env.DEMO_MODE = previous ?? "false";
    }
  });
});

describe("buildPaymentInstructions (customer-facing, ADR 0003)", () => {
  it("COD_CASH → single cash step", () => {
    expect(buildPaymentInstructions({ number: "ZBL-00000001" }, PaymentMethod.COD_CASH)).toEqual({
      title: "Cash on delivery",
      steps: ["Pay in cash when your order arrives."],
    });
  });

  it("COD_MOBILE_MONEY → MoMo lines with the shop number", () => {
    const result = buildPaymentInstructions({ number: "ZBL-00000001" }, PaymentMethod.COD_MOBILE_MONEY);
    expect(result.title).toBe("Mobile money on delivery");
    expect(result.steps[0]).toContain(SHOP_MOMO);
  });

  it("BANK_TRANSFER → bank details + order number as the transfer reference", () => {
    const result = buildPaymentInstructions({ number: "ZBL-00000001" }, PaymentMethod.BANK_TRANSFER);
    expect(result.title).toBe("Bank transfer");
    expect(result.steps[0]).toBe(BANK_DETAILS_RAW);
    expect(result.steps).toContain("Use the order number ZBL-00000001 as your transfer reference.");
  });

  it("throws ValidationError for reserved methods", () => {
    expect(() => buildPaymentInstructions({ number: "ZBL-1" }, PaymentMethod.MOMO_GATEWAY)).toThrow(ValidationError);
    expect(() => buildPaymentInstructions({ number: "ZBL-1" }, PaymentMethod.CARD)).toThrow(ValidationError);
  });

  it("mobileMoneyLines includes the confirmation-code step", () => {
    const lines = mobileMoneyLines();
    expect(lines).toContain("Have the MoMo confirmation code ready for the delivery agent.");
  });
});
