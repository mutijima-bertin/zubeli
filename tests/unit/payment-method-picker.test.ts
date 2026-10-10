/**
 * visiblePaymentOptions / FALLBACK_PAYMENT_METHOD — the pure payment-step
 * helper exported from src/app/(store)/checkout/_components/PaymentMethodPicker.tsx
 * (checkout-agent owns that file; this spec only consumes the exports).
 *
 * Behaviour under test (the "configurable sub-set" the storefront is launched
 * with): the options a customer may actually pick = catalogue ∩ allowlist, in
 * CATALOGUE order (cash first), degrading to cash on delivery whenever the
 * allowlist is missing, empty, or names nothing this screen can render — a
 * payment step must never be unusable.
 */
import { describe, expect, it } from "vitest";
import type { PaymentMethod } from "@/types/api";
import {
  FALLBACK_PAYMENT_METHOD,
  PAYMENT_OPTIONS,
  visiblePaymentOptions,
} from "@/app/(store)/checkout/_components/PaymentMethodPicker";

const COD_CASH = "COD_CASH";
const COD_MOBILE_MONEY = "COD_MOBILE_MONEY";
const BANK_TRANSFER = "BANK_TRANSFER";

function methods(allowed: PaymentMethod[] | null | undefined): PaymentMethod[] {
  return visiblePaymentOptions(allowed).map((option) => option.method);
}

describe("visiblePaymentOptions", () => {
  it("offers all three MVP methods in catalogue order, cash first", () => {
    expect(methods([COD_CASH, COD_MOBILE_MONEY, BANK_TRANSFER])).toEqual([
      COD_CASH,
      COD_MOBILE_MONEY,
      BANK_TRANSFER,
    ]);
  });

  it("narrows to exactly the single allowed method: ['COD_CASH']", () => {
    expect(methods([COD_CASH])).toEqual([COD_CASH]);
  });

  it("narrows to exactly the single allowed method: ['BANK_TRANSFER']", () => {
    expect(methods([BANK_TRANSFER])).toEqual([BANK_TRANSFER]);
  });

  it("falls back to cash on delivery for an empty allowlist", () => {
    expect(methods([])).toEqual([COD_CASH]);
  });

  it("falls back to cash on delivery when the allowlist is null", () => {
    expect(methods(null)).toEqual([COD_CASH]);
  });

  it("falls back to cash on delivery when the allowlist is undefined", () => {
    expect(methods(undefined)).toEqual([COD_CASH]);
  });

  it("never throws on garbage values and still yields at least cash", () => {
    // A reserved provider enum the screen cannot render, junk strings, numbers,
    // and null mixed in: the server owns their validation, this screen must not
    // crash or render an empty radio group.
    const garbage = ["MOMO_GATEWAY", "CARD", "NOT_A_METHOD", "", 42, null] as unknown as PaymentMethod[];
    expect(() => visiblePaymentOptions(garbage)).not.toThrow();
    const visible = methods(garbage);
    expect(visible).toContain(COD_CASH);
    expect(visible.every((m) => PAYMENT_OPTIONS.some((o) => o.method === m))).toBe(true);
  });

  it("drops the unknown entries but keeps the renderable ones", () => {
    const visible = methods(["CARD", BANK_TRANSFER, "NOT_A_METHOD"] as unknown as PaymentMethod[]);
    expect(visible).toEqual([BANK_TRANSFER]);
  });

  it("collapses duplicates", () => {
    expect(methods([COD_CASH, COD_CASH, BANK_TRANSFER, COD_CASH])).toEqual([COD_CASH, BANK_TRANSFER]);
    // …and an allowlist of nothing but duplicates of one method is still one option.
    expect(methods([COD_MOBILE_MONEY, COD_MOBILE_MONEY])).toEqual([COD_MOBILE_MONEY]);
  });

  it("preserves catalogue order even when the allowlist is given in another order", () => {
    expect(methods([BANK_TRANSFER, COD_CASH, COD_MOBILE_MONEY])).toEqual([
      COD_CASH,
      COD_MOBILE_MONEY,
      BANK_TRANSFER,
    ]);
    expect(methods([COD_MOBILE_MONEY, BANK_TRANSFER])).toEqual([COD_MOBILE_MONEY, BANK_TRANSFER]);
  });

  it("never mutates the catalogue and always returns renderable option configs", () => {
    const catalogueBefore = PAYMENT_OPTIONS.map((o) => o.method);
    const visible = visiblePaymentOptions([BANK_TRANSFER]);
    expect(PAYMENT_OPTIONS.map((o) => o.method)).toEqual(catalogueBefore);
    for (const option of visible) {
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
      expect(PAYMENT_OPTIONS).toContainEqual(option); // identity, not a copy
    }
  });
});

describe("FALLBACK_PAYMENT_METHOD", () => {
  it("is cash on delivery — the method that needs no extra input or provider", () => {
    expect(FALLBACK_PAYMENT_METHOD).toBe("COD_CASH");
    expect(PAYMENT_OPTIONS.find((o) => o.method === FALLBACK_PAYMENT_METHOD)?.requiresReference).toBeUndefined();
  });

  it("is guaranteed whenever the allowlist is unusable — never an empty payment step", () => {
    // Fallback applies only when nothing renderable is allowed: a valid
    // allowlist legitimately excludes cash (e.g. ['BANK_TRANSFER'] offers only
    // bank transfer — the server, not this helper, decides what is sellable).
    for (const allowlist of [null, undefined, [], ["CARD"] as unknown as PaymentMethod[]]) {
      expect(methods(allowlist)).toEqual([FALLBACK_PAYMENT_METHOD]);
    }
  });
});