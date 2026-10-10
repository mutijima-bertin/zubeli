/**
 * Client-safe formatting + status maps. Ships to the browser bundle — NO
 * server-only imports here, ever (screen agents render these in client
 * components and inside SSR'd pages alike).
 *
 * Money is integer minor units: 1 RWF = 1 unit (ADR 0004).
 * Dates render in BUSINESS_TIME_ZONE (Africa/Kigali), never the runtime's local
 * zone — production runs UTC, so an un-pinned toLocale* would show the wrong
 * day for orders placed in the evening (src/lib/time.ts is dependency-free).
 */
import { BUSINESS_TIME_ZONE } from "@/lib/time";
import type {
  InventoryMovementType,
  InventoryReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/api";

export type StatusTone = "neutral" | "brand" | "success" | "danger" | "info" | "warning";
export type StatusMeta = { label: string; tone: StatusTone };

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

// Hoisted once: formatRWF runs per row in grids/tables/summaries. The locale
// is fixed; `currency` only changes the appended suffix, so a single formatter
// is safe (no keying needed).
const RWF_NUMBER_FORMAT = new Intl.NumberFormat("en-RW");

/**
 * "12,500 RWF" — no decimals (RWF has none). Negative amounts (refunds)
 * format with a leading minus sign.
 */
export function formatRWF(cents: number, currency = "RWF"): string {
  const value = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  return `${RWF_NUMBER_FORMAT.format(value)} ${currency}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

// Same style as before, now pinned to business time (Africa/Kigali): without
// timeZone these render in the runtime's local zone (UTC on Vercel).
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: BUSINESS_TIME_ZONE,
};
const DATETIME_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
};

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "5 Aug 2026" — safe for null/invalid input (renders "—"). */
export function formatDate(iso: string | null | undefined): string {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString("en-GB", DATE_FORMAT) : "—";
}

/** "5 Aug 2026, 14:30" — safe for null/invalid input. */
export function formatDateTime(iso: string | null | undefined): string {
  const date = parseDate(iso);
  return date ? date.toLocaleString("en-GB", DATETIME_FORMAT) : "—";
}

// ---------------------------------------------------------------------------
// Status → copy + tone maps (drive Badge + Timeline rendering)
// ---------------------------------------------------------------------------

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: { label: "Pending", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  FULFILLED: { label: "Fulfilled", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  PENDING: { label: "Awaiting payment", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};

export const PAYMENT_METHOD_META: Record<PaymentMethod, StatusMeta> = {
  COD_CASH: { label: "Pay on delivery — Cash", tone: "neutral" },
  COD_MOBILE_MONEY: { label: "Pay on delivery — Mobile Money", tone: "brand" },
  BANK_TRANSFER: { label: "Bank transfer", tone: "info" },
  MOMO_GATEWAY: { label: "Mobile Money (gateway)", tone: "neutral" },
  CARD: { label: "Card", tone: "neutral" },
};

export const INVENTORY_MOVEMENT_TYPE_META: Record<InventoryMovementType, StatusMeta> = {
  IN: { label: "Stock in", tone: "success" },
  OUT: { label: "Stock out", tone: "danger" },
};

export const INVENTORY_REASON_META: Record<InventoryReason, StatusMeta> = {
  RESTOCK: { label: "Restock", tone: "success" },
  ORDER: { label: "Order", tone: "info" },
  ADJUSTMENT: { label: "Adjustment", tone: "warning" },
  RETURN: { label: "Return", tone: "neutral" },
  CANCEL: { label: "Cancellation", tone: "danger" },
};

export function orderStatusMeta(status: OrderStatus): StatusMeta {
  return ORDER_STATUS_META[status];
}

export function paymentStatusMeta(status: PaymentStatus): StatusMeta {
  return PAYMENT_STATUS_META[status];
}

export function paymentMethodMeta(method: PaymentMethod): StatusMeta {
  return PAYMENT_METHOD_META[method];
}