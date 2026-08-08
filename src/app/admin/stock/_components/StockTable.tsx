"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { listStockAdminAction } from "@/actions/admin/stock";
import { DataTable, FilterBar, StatusBadge, type DataTableColumn } from "@/components/admin";
import { Alert, Badge, Button, IconSearch, Input } from "@/components/ui";
import type { Page, ProductDTO } from "@/types/api";
import { AdjustStockDialog } from "./AdjustStockDialog";
import { stockLevel, stockLevelMeta } from "./stockLevel";

const PAGE_SIZE = 20;

type Query = { search?: string; includeDeleted?: boolean; limit: number; cursor?: string };

/**
 * Stock levels table — filters (search + include deleted) and cursor
 * load-more against listStockAdminAction, plus the per-row adjust dialog.
 * Filters are debounced client-side; the cursor resets whenever they change.
 */
export function StockTable({
  initialPage,
  initialError,
  onStockChanged,
}: {
  initialPage: Page<ProductDTO> | null;
  initialError: string | null;
  onStockChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<ProductDTO[]>(() => initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState<boolean>(initialPage?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [tableError, setTableError] = useState<string | null>(initialError);
  const [adjusting, setAdjusting] = useState<ProductDTO | null>(null);

  // Refs keep the latest filter values readable from async callbacks without
  // re-creating them (no stale closures).
  const searchRef = useRef("");
  const includeDeletedRef = useRef(false);
  const requestId = useRef(0);
  const firstRender = useRef(true);

  const buildQuery = useCallback((extra: { cursor?: string } = {}): Query => {
    const query: Query = { limit: PAGE_SIZE };
    const term = searchRef.current.trim();
    if (term) query.search = term;
    if (includeDeletedRef.current) query.includeDeleted = true;
    if (extra.cursor) query.cursor = extra.cursor;
    return query;
  }, []);

  const refetchFirstPage = useCallback(() => {
    const id = ++requestId.current;
    startTransition(async () => {
      const res = await listStockAdminAction(buildQuery());
      if (id !== requestId.current) return;
      if (!res.ok) {
        setTableError(res.error.message);
        return;
      }
      setTableError(null);
      setProducts(res.data.items);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    });
  }, [buildQuery, startTransition]);

  // Debounced refetch while typing / toggling filters (skips initial mount
  // — the first page already comes from the server).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => refetchFirstPage(), 250);
    return () => window.clearTimeout(timer);
  }, [search, includeDeleted, refetchFirstPage]);

  function loadMore() {
    if (loadingMore || !hasMore || !nextCursor) return;
    const id = ++requestId.current;
    setLoadingMore(true);
    void (async () => {
      const res = await listStockAdminAction(buildQuery({ cursor: nextCursor }));
      if (id !== requestId.current) return;
      setLoadingMore(false);
      if (!res.ok) {
        setTableError(res.error.message);
        return;
      }
      setProducts((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    })();
  }

  function clearFilters() {
    searchRef.current = "";
    includeDeletedRef.current = false;
    setSearch("");
    setIncludeDeleted(false);
  }

  function handleAdjusted(updated: ProductDTO) {
    setProducts((prev) =>
      prev.map((product) => (product.id === updated.id ? updated : product)),
    );
    onStockChanged();
  }

  const hasActiveFilters = search.trim() !== "" || includeDeleted;

  const columns: DataTableColumn<ProductDTO>[] = [
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="font-medium text-ink hover:text-brand-700 hover:underline"
          >
            {product.name}
          </Link>
          {!product.isPublished && <Badge tone="neutral">Hidden</Badge>}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (product) => <span className="text-stone-600">{product.category.name}</span>,
    },
    {
      key: "level",
      header: "Level",
      render: (product) => (
        <span className="whitespace-nowrap">
          <span className="font-semibold tabular-nums text-ink">{product.stockQty}</span>
          <span className="ml-1 text-stone-400">/ {product.lowStockThreshold}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (product) => (
        <StatusBadge
          meta={stockLevelMeta(stockLevel(product.stockQty, product.lowStockThreshold))}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (product) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdjusting(product)}
        >
          Adjust
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Stock levels</h2>

      <FilterBar
        title="Filters"
        filters={
          <>
            <label className="sr-only" htmlFor="stock-search">
              Search products
            </label>
            <div className="relative">
              <Input
                id="stock-search"
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(event) => {
                  searchRef.current = event.target.value;
                  setSearch(event.target.value);
                }}
                className="w-60 pr-9"
              />
              <IconSearch
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                strokeWidth={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  includeDeletedRef.current = event.target.checked;
                  setIncludeDeleted(event.target.checked);
                }}
                className="size-4 rounded border-stone-300 accent-brand-600"
              />
              Include deleted
            </label>
          </>
        }
        summary={<span className="text-sm text-stone-500">{products.length} shown</span>}
        actions={
          hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : undefined
        }
      />

      {tableError && products.length === 0 && (
        <Alert tone="danger" title="Could not load products">
          <div className="flex items-center justify-between gap-3">
            <span>{tableError}</span>
            <Button type="button" variant="outline" size="sm" onClick={refetchFirstPage}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={products}
        rowKey={(product) => product.id}
        ariaLabel="Stock levels table"
        loading={isPending && products.length === 0}
        skeletonRows={5}
        error={tableError && products.length > 0 ? tableError : undefined}
        emptyTitle="No products found"
        emptyDescription="Try clearing the filters, or adjust stock to start tracking levels."
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        loadMoreLabel="Load more products"
        loadMoreEndLabel={null}
      />

      {adjusting && (
        <AdjustStockDialog
          key={adjusting.id}
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onAdjusted={(updated) => {
            handleAdjusted(updated);
            setAdjusting(null);
          }}
        />
      )}
    </div>
  );
}