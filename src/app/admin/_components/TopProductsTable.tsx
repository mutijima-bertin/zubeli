import { DataTable } from "@/components/admin";
import { formatRWF } from "@/lib/format";
import type { TopProductDTO } from "@/types/api";

/**
 * Top-products ranking (sales-agent). Shared by the Overview and Sales
 * screens: product name (whole-row link to the product when it still
 * exists), revenue and units. Empty state lives inside DataTable.
 */
export function TopProductsTable({ products }: { products: TopProductDTO[] }) {
  return (
    <DataTable
      columns={[
        {
          key: "productName",
          header: "Product",
          render: (row) => row.productName ?? "—",
        },
        {
          key: "revenueCents",
          header: "Revenue",
          className: "text-right",
          render: (row) => formatRWF(row.revenueCents),
        },
        {
          key: "unitsSold",
          header: "Units",
          className: "text-right",
          render: (row) => row.unitsSold,
        },
      ]}
      data={products}
      rowKey={(row) => row.productId ?? `deleted:${row.productName ?? "?"}:${row.unitsSold}`}
      rowLink={(row) => (row.productId ? `/admin/products/${row.productId}` : null)}
      ariaLabel="Top products by revenue"
      emptyTitle="No product sales yet"
      emptyDescription="Sales from paid and fulfilled orders will rank your best-selling products here."
    />
  );
}