import { StatCard } from "@/components/admin";
import { Alert, IconAlert, IconBox, IconCheck, IconWarning } from "@/components/ui";
import type { ActionResult, Page, ProductDTO } from "@/types/api";

/**
 * Stock summary KPI band (server-rendered). Computed from the full product
 * list (limit 100, no filters) — the stock actions expose no dedicated KPI
 * endpoint, so these counts come straight from the list response.
 */
export function StockKpis({ result }: { result: ActionResult<Page<ProductDTO>> }) {
  if (!result.ok) {
    return (
      <Alert tone="danger" title="Could not load stock summary">
        {result.error.message}
      </Alert>
    );
  }

  const items = result.data.items;
  const productCount = items.length;
  const outOfStockCount = items.filter((product) => product.stockQty <= 0).length;
  const lowStockCount = items.filter(
    (product) => product.stockQty > 0 && product.stockQty <= product.lowStockThreshold,
  ).length;
  const totalStockQty = items.reduce((sum, product) => sum + product.stockQty, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Products"
        value={productCount}
        icon={<IconBox className="size-5" />}
        tone="brand"
      />
      <StatCard
        title="Out of stock"
        value={outOfStockCount}
        icon={<IconAlert className="size-5" />}
        tone="danger"
      />
      <StatCard
        title="Low stock"
        value={lowStockCount}
        icon={<IconWarning className="size-5" />}
        tone="warning"
      />
      <StatCard
        title="Items in stock"
        value={totalStockQty}
        icon={<IconCheck className="size-5" />}
        tone="neutral"
      />
    </div>
  );
}