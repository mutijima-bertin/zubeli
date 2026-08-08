"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listMovementsAction } from "@/actions/admin/stock";
import { DataTable, StatusBadge, type DataTableColumn } from "@/components/admin";
import { Alert, Button, cx } from "@/components/ui";
import {
  formatDateTime,
  INVENTORY_MOVEMENT_TYPE_META,
  INVENTORY_REASON_META,
} from "@/lib/format";
import type { Page, StockMovementDTO } from "@/types/api";

const PAGE_SIZE = 10;

/**
 * Stock ledger (newest first, cursor-paginated). One shared table for the
 * whole catalog — filtering by product is intentionally skipped for the MVP
 * (the brief's default). `refreshKey` makes the parent re-fetch the first
 * page after an adjustment so the new movement lands on top.
 */
export function MovementsLedger({
  initialPage,
  initialError,
  refreshKey,
}: {
  initialPage: Page<StockMovementDTO> | null;
  initialError: string | null;
  refreshKey: number;
}) {
  const [items, setItems] = useState<StockMovementDTO[]>(() => initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState<boolean>(initialPage?.hasMore ?? false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const requestId = useRef(0);
  const firstRender = useRef(true);

  const refresh = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await listMovementsAction({ limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setItems(res.data.items);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    })();
  }, []);

  // Refresh the ledger whenever the parent signals a stock change
  // (adjustment saved). Skips the first render — initial page comes from
  // the server.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    refresh();
  }, [refreshKey, refresh]);

  function loadMore() {
    if (loadingMore || !hasMore || !nextCursor) return;
    const id = ++requestId.current;
    setLoadingMore(true);
    void (async () => {
      const res = await listMovementsAction({ limit: PAGE_SIZE, cursor: nextCursor });
      if (id !== requestId.current) return;
      setLoadingMore(false);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    })();
  }

  const columns: DataTableColumn<StockMovementDTO>[] = [
    {
      key: "productName",
      header: "Product",
      render: (movement) => (
        <Link
          href={`/products/${movement.productSlug}`}
          className="font-medium text-ink hover:text-brand-700 hover:underline"
        >
          {movement.productName}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (movement) => <StatusBadge meta={INVENTORY_MOVEMENT_TYPE_META[movement.type]} />,
    },
    {
      key: "reason",
      header: "Reason",
      render: (movement) => <StatusBadge meta={INVENTORY_REASON_META[movement.reason]} />,
    },
    {
      key: "quantity",
      header: "Qty",
      className: "text-right",
      render: (movement) => (
        <span
          className={cx(
            "font-semibold tabular-nums",
            movement.type === "IN" ? "text-success-700" : "text-danger-600",
          )}
        >
          {movement.type === "IN" ? "+" : "−"}
          {movement.quantity}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      render: (movement) => (
        <span className="whitespace-nowrap text-stone-600">
          {formatDateTime(movement.createdAt)}
        </span>
      ),
    },
    {
      key: "orderNumber",
      header: "Order",
      render: (movement) =>
        movement.orderNumber ? (
          <span className="font-medium text-stone-700">{movement.orderNumber}</span>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Recent movements</h2>
        <p className="text-sm text-stone-500">Newest first</p>
      </div>

      {error && items.length === 0 && (
        <Alert tone="danger" title="Could not load stock movements">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(movement) => movement.id}
        ariaLabel="Stock movement ledger"
        loading={loading && items.length === 0}
        skeletonRows={5}
        error={error && items.length > 0 ? error : undefined}
        emptyTitle="No stock movements yet"
        emptyDescription="Adjust stock above to record the first ledger movement."
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        loadMoreLabel="Load more movements"
        loadMoreEndLabel={null}
      />
    </div>
  );
}