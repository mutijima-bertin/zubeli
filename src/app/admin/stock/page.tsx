import type { Metadata } from "next";
import { listMovementsAction, listStockAdminAction } from "@/actions/admin/stock";
import { StockKpis } from "./_components/StockKpis";
import { StockScreen } from "./_components/StockScreen";

export const metadata: Metadata = {
  title: "Stock | Admin | Zubeli",
  description:
    "Track stock levels, resolve low-stock items and review the inventory movement ledger.",
};

/**
 * Admin stock screen (stock-agent). Server shell: header, KPI band (from a
 * full list call — stock actions expose no dedicated KPI endpoint) and the
 * client screen that owns the filterable table plus the movements ledger.
 * Auth is enforced by the admin layout + middleware before this renders.
 */
export default async function AdminStockPage() {
  const [kpis, products, movements] = await Promise.all([
    listStockAdminAction({ limit: 100 }),
    listStockAdminAction({ limit: 20 }),
    listMovementsAction({ limit: 10 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Stock</h1>
        <p className="mt-1 text-sm text-stone-500">
          Track quantities, resolve low-stock items and review every stock movement.
        </p>
      </div>

      <StockKpis result={kpis} />

      <StockScreen
        initialProducts={products.ok ? products.data : null}
        initialProductsError={products.ok ? null : products.error.message}
        initialMovements={movements.ok ? movements.data : null}
        initialMovementsError={movements.ok ? null : movements.error.message}
      />
    </div>
  );
}