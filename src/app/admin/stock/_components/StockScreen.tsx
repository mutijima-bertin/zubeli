"use client";
import { useState } from "react";
import { ToastProvider } from "@/components/ui";
import type { Page, ProductDTO, StockMovementDTO } from "@/types/api";
import { MovementsLedger } from "./MovementsLedger";
import { StockTable } from "./StockTable";

/**
 * Admin stock screen shell. The admin layout has no global ToastProvider
 * (storefront layout only), so one is mounted here for the success toasts
 * after a stock adjustment. `StockTable` bumps `movementRefreshKey` after
 * an adjustment so the ledger re-fetches its first page.
 */
export function StockScreen({
  initialProducts,
  initialProductsError,
  initialMovements,
  initialMovementsError,
}: {
  initialProducts: Page<ProductDTO> | null;
  initialProductsError: string | null;
  initialMovements: Page<StockMovementDTO> | null;
  initialMovementsError: string | null;
}) {
  const [movementRefreshKey, setMovementRefreshKey] = useState(0);

  return (
    <ToastProvider>
      <div className="space-y-10">
        <StockTable
          initialPage={initialProducts}
          initialError={initialProductsError}
          onStockChanged={() => setMovementRefreshKey((key) => key + 1)}
        />
        <MovementsLedger
          initialPage={initialMovements}
          initialError={initialMovementsError}
          refreshKey={movementRefreshKey}
        />
      </div>
    </ToastProvider>
  );
}