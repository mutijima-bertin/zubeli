import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatRWF,
  INVENTORY_MOVEMENT_TYPE_META,
  INVENTORY_REASON_META,
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  paymentMethodMeta,
  paymentStatusMeta,
  orderStatusMeta,
} from "@/lib/format";

describe("formatRWF", () => {
  it("formats integer minor units with grouping and the RWF suffix", () => {
    expect(formatRWF(12500)).toBe("12,500 RWF");
    expect(formatRWF(0)).toBe("0 RWF");
    expect(formatRWF(1_000_000)).toBe("1,000,000 RWF");
  });

  it("grouping boundary: no separator below 1000, starts at 1000", () => {
    expect(formatRWF(999)).toBe("999 RWF");
    expect(formatRWF(1000)).toBe("1,000 RWF");
    expect(formatRWF(9999)).toBe("9,999 RWF");
  });

  it("supports a custom currency label", () => {
    expect(formatRWF(500, "USD")).toBe("500 USD");
  });

  it("truncates fractions and neutralizes non-finite input", () => {
    expect(formatRWF(12.9)).toBe("12 RWF");
    expect(formatRWF(Number.NaN)).toBe("0 RWF");
    expect(formatRWF(Number.POSITIVE_INFINITY)).toBe("0 RWF");
  });

  it("formats negatives (refunds) with a leading minus", () => {
    expect(formatRWF(-2500)).toBe("-2,500 RWF");
  });
});

describe("date formatting", () => {
  it("formats ISO dates and datetimes", () => {
    expect(formatDate("2026-08-05T10:30:00.000Z")).toMatch(/Aug/);
    expect(formatDateTime("2026-08-05T10:30:00.000Z")).toMatch(/Aug/);
    expect(formatDateTime("2026-08-05T10:30:00.000Z")).toMatch(/\d{2}:\d{2}/);
  });

  it("projects instants into BUSINESS_TIME_ZONE (Africa/Kigali), not the runtime zone", () => {
    // 23:30 UTC is already the next calendar day in Kigali (UTC+2, no DST), and
    // 21:45 UTC is still the same day. These exact strings fail if the
    // timeZone pin is dropped on a UTC runtime (the production zone) — the loose
    // /Aug/ assertions above cannot catch that.
    expect(formatDate("2026-08-05T23:30:00.000Z")).toBe("6 Aug 2026");
    expect(formatDate("2026-08-05T21:45:00.000Z")).toBe("5 Aug 2026");
    expect(formatDateTime("2026-08-05T23:30:00.000Z")).toBe("6 Aug 2026, 01:30");
    expect(formatDateTime("2026-08-05T10:30:00.000Z")).toBe("5 Aug 2026, 12:30");
  });

  it("is null-safe", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("status tone maps", () => {
  it("maps every OrderStatus to copy + a valid tone", () => {
    expect(orderStatusMeta("PENDING")).toEqual({ label: "Pending", tone: "warning" });
    expect(orderStatusMeta("PAID").tone).toBe("success");
    expect(orderStatusMeta("FULFILLED").tone).toBe("success");
    expect(orderStatusMeta("CANCELLED").tone).toBe("danger");
    expect(orderStatusMeta("REFUNDED").tone).toBe("neutral");
    expect(Object.keys(ORDER_STATUS_META).sort()).toEqual(
      ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"].sort(),
    );
  });

  it("maps every PaymentStatus to copy + a valid tone", () => {
    expect(paymentStatusMeta("PENDING")).toEqual({ label: "Awaiting payment", tone: "warning" });
    expect(paymentStatusMeta("PAID").tone).toBe("success");
    expect(paymentStatusMeta("FAILED").tone).toBe("danger");
    expect(paymentStatusMeta("REFUNDED").tone).toBe("neutral");
    expect(Object.keys(PAYMENT_STATUS_META)).toEqual(["PENDING", "PAID", "REFUNDED", "FAILED"]);
  });

  it("maps every PaymentMethod, including the reserved gateway placeholders", () => {
    expect(paymentMethodMeta("COD_CASH").label).toContain("Cash");
    expect(paymentMethodMeta("COD_MOBILE_MONEY").label).toContain("Mobile Money");
    expect(paymentMethodMeta("BANK_TRANSFER").label).toContain("Bank transfer");
    expect(Object.keys(PAYMENT_METHOD_META).sort()).toEqual(
      ["COD_CASH", "COD_MOBILE_MONEY", "BANK_TRANSFER", "MOMO_GATEWAY", "CARD"].sort(),
    );
  });

  it("every map entry carries one of the Badge tones", () => {
    const tones = ["neutral", "brand", "success", "danger", "info", "warning"];
    const all = [
      ...Object.values(ORDER_STATUS_META),
      ...Object.values(PAYMENT_STATUS_META),
      ...Object.values(PAYMENT_METHOD_META),
      ...Object.values(INVENTORY_MOVEMENT_TYPE_META),
      ...Object.values(INVENTORY_REASON_META),
    ];
    for (const meta of all) expect(tones).toContain(meta.tone);
  });

  it("maps every inventory movement type and reason (stock screens)", () => {
    expect(INVENTORY_MOVEMENT_TYPE_META.IN.label).toBe("Stock in");
    expect(INVENTORY_MOVEMENT_TYPE_META.OUT.label).toBe("Stock out");
    expect(Object.keys(INVENTORY_MOVEMENT_TYPE_META).sort()).toEqual(["IN", "OUT"].sort());

    expect(INVENTORY_REASON_META.RESTOCK.tone).toBe("success");
    expect(INVENTORY_REASON_META.ORDER.tone).toBe("info");
    expect(INVENTORY_REASON_META.ADJUSTMENT.tone).toBe("warning");
    expect(INVENTORY_REASON_META.RETURN.tone).toBe("neutral");
    expect(INVENTORY_REASON_META.CANCEL.tone).toBe("danger");
    expect(Object.keys(INVENTORY_REASON_META).sort()).toEqual(
      ["RESTOCK", "ORDER", "ADJUSTMENT", "RETURN", "CANCEL"].sort(),
    );
  });
});