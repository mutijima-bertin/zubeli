/**
 * Stock-level semantics for the admin stock screen (OUT / LOW / OK),
 * purely derived from quantity + threshold. Client-safe.
 */
import type { StatusMeta } from "@/lib/format";

export type StockLevel = "OK" | "LOW" | "OUT";

export function stockLevel(stockQty: number, lowStockThreshold: number): StockLevel {
  if (stockQty <= 0) return "OUT";
  if (stockQty <= lowStockThreshold) return "LOW";
  return "OK";
}

export function stockLevelMeta(level: StockLevel): StatusMeta {
  switch (level) {
    case "OUT":
      return { label: "Out of stock", tone: "danger" };
    case "LOW":
      return { label: "Low stock", tone: "warning" };
    case "OK":
      return { label: "In stock", tone: "success" };
  }
}