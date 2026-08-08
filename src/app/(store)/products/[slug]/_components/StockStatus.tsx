import { Badge } from "@/components/ui";

/**
 * Live stock status badge from the DTO's real lowStockThreshold:
 * - stockQty === 0 → "Out of stock" (danger)
 * - stockQty <= lowStockThreshold → "Only X left" (warning)
 * - otherwise → "In stock" (success)
 *
 * Never color-only: the copy states the condition explicitly.
 */
export function StockStatus({
  stockQty,
  lowStockThreshold,
}: {
  stockQty: number;
  lowStockThreshold: number;
}) {
  if (stockQty <= 0) {
    return <Badge tone="danger">Out of stock</Badge>;
  }
  if (stockQty <= lowStockThreshold) {
    return <Badge tone="warning">Only {stockQty} left in stock</Badge>;
  }
  return <Badge tone="success">In stock</Badge>;
}
