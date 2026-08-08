'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { listOrdersAdminAction } from '@/actions/admin/orders';
import { DataTable, FilterBar, StatusBadge, type DataTableColumn } from '@/components/admin';
import { Alert, Button, IconSearch, Input, Price, Select } from '@/components/ui';
import {
  formatDateTime,
  orderStatusMeta,
  paymentStatusMeta,
} from '@/lib/format';
import type { OrderListItemDTO, OrderStatus, Page, PaymentMethod } from '@/types/api';
import { ORDER_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS } from './orders-options';

export type OrdersListProps = {
  status?: OrderStatus;
  method?: PaymentMethod;
  q?: string;
  /** Server-rendered first page (URL owns the filters — see page.tsx). */
  initialPage: Page<OrderListItemDTO>;
};

/**
 * Orders list (client). The FilterBar drives the URL (?status, ?method, ?q)
 * — the server page re-renders per combination and this component remounts
 * (keyed by the page) with fresh props. Cursor load-more accumulates
 * additional pages client-side without touching the URL.
 */
export function OrdersList({ status, method, q, initialPage }: OrdersListProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasFilters = Boolean(status || method || q);

  function navigate(next: { status?: string; method?: string; q?: string }) {
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.method) params.set('method', next.method);
    if (next.q) params.set('q', next.q);
    const qs = params.toString();
    router.replace(qs ? `/admin/orders?${qs}` : '/admin/orders', { scroll: false });
  }

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get('q') ?? '').trim();
    navigate({ status, method, q: next || undefined });
  }

  async function loadMore() {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setLoadError(null);
    const result = await listOrdersAdminAction({
      status,
      paymentMethod: method,
      search: q,
      cursor: nextCursor,
    });
    if (result.ok) {
      setRows((prev) => [...prev, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    } else {
      setLoadError(result.error.message);
    }
    setLoadingMore(false);
  }

  const columns: DataTableColumn<OrderListItemDTO>[] = [
    {
      key: 'number',
      header: 'Order',
      render: (row) => <span className="font-semibold text-ink">{row.number}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            {row.customerName ?? row.customerEmail ?? 'Guest'}
          </p>
          {row.customerPhone && (
            <p className="truncate text-xs text-stone-500">{row.customerPhone}</p>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Placed',
      className: 'whitespace-nowrap',
      render: (row) => <span className="text-sm text-stone-600">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      className: 'text-right',
      render: (row) => (
        <span className="text-stone-600">
          {row.items.length} {row.items.length === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'whitespace-nowrap text-right',
      render: (row) => <Price cents={row.totalCents} currency={row.currency} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge meta={orderStatusMeta(row.status)} />,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => <StatusBadge meta={paymentStatusMeta(row.paymentStatus)} />,
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        title="Filters"
        filters={
          <>
            <Select
              aria-label="Filter by order status"
              className="w-44"
              value={status ?? ''}
              onChange={(event) => navigate({ status: event.target.value || undefined, method, q })}
            >
              <option value="">All statuses</option>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by payment method"
              className="w-52"
              value={method ?? ''}
              onChange={(event) => navigate({ method: event.target.value || undefined, status, q })}
            >
              <option value="">All payment methods</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <form className="flex items-center gap-2" role="search" onSubmit={onSearchSubmit}>
              <div className="relative">
                <Input
                  type="search"
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder="Search number, name, phone"
                  aria-label="Search orders"
                  className="w-64 pr-9"
                />
                <IconSearch
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                  strokeWidth={2}
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>
          </>
        }
      />

      {loadError && (
        <Alert tone="danger" title="Couldn't load more orders">
          {loadError}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        rowLink={(row) => `/admin/orders/${row.id}`}
        ariaLabel="Orders list"
        emptyTitle={hasFilters ? 'No matching orders' : 'No orders yet'}
        emptyDescription={
          hasFilters
            ? 'No orders match the current filters — try clearing or adjusting them.'
            : 'Orders placed on the storefront will appear here.'
        }
        emptyAction={
          hasFilters ? (
            <Button href="/admin/orders" variant="outline" size="sm">
              Clear filters
            </Button>
          ) : undefined
        }
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        loadMoreLabel="Load more orders"
        loadMoreEndLabel={null}
      />
    </div>
  );
}