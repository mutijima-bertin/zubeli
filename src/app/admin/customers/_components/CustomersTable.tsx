"use client";
import { useState } from "react";
import { listCustomersAdminAction } from "@/actions/admin/customers";
import {
  DataTable,
  IconChartBar,
  IconReceipt,
  IconUsers,
  StatCard,
} from "@/components/admin";
import type { DataTableColumn } from "@/components/admin";
import { Alert, Badge } from "@/components/ui";
import { formatDate, formatRWF } from "@/lib/format";
import type { CustomerDTO } from "@/types/api";

const PAGE_SIZE = 25;

function rowKeyOf(row: CustomerDTO): string {
  return row.id ? `user:${row.id}` : `guest:${row.phone}:${row.name.toLowerCase()}`;
}

const columns: DataTableColumn<CustomerDTO>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{row.name}</span>
        {row.id === null && <Badge tone="neutral">Guest</Badge>}
      </span>
    ),
  },
  { key: "phone", header: "Phone" },
  { key: "email", header: "Email" },
  { key: "ordersCount", header: "Orders", className: "text-right" },
  {
    key: "totalSpentCents",
    header: "Total spent",
    className: "text-right",
    render: (row) => formatRWF(row.totalSpentCents),
  },
  {
    key: "lastOrderAt",
    header: "Last order",
    render: (row) => formatDate(row.lastOrderAt),
  },
];

/**
 * Customers list body (Milestone 5 — customers-screen-agent). Client-owned
 * cursor pagination over listCustomersAdminAction: page 1 arrives as props,
 * load-more appends rows (search preserved from props). KPI cards on top
 * aggregate the loaded rows — at MVP volumes the whole list fits page 1.
 * Guest rows (`id: null`) never link to a detail page (none exists).
 */
export function CustomersTable({
  search,
  initialItems,
  initialNextCursor,
  initialHasMore,
}: {
  search?: string;
  initialItems: CustomerDTO[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState<CustomerDTO[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (loading || !nextCursor) return;
    setLoading(true);
    setError(null);
    const res = await listCustomersAdminAction({ search, cursor: nextCursor, limit: PAGE_SIZE });
    if (res.ok) {
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  const payingCustomers = items.filter((c) => c.totalSpentCents > 0).length;
  const revenueCents = items.reduce((sum, c) => sum + c.totalSpentCents, 0);

  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        {loading ? "Loading more customers" : `Showing ${items.length} customers`}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Customers"
          value={items.length}
          icon={<IconUsers className="size-5" />}
          tone="brand"
        />
        <StatCard
          title="Paying customers"
          value={payingCustomers}
          icon={<IconReceipt className="size-5" />}
          tone="success"
        />
        <StatCard
          title="Revenue (paid)"
          value={revenueCents}
          format={(value) => formatRWF(Number(value))}
          icon={<IconChartBar className="size-5" />}
          tone="info"
        />
      </div>

      {error && (
        <Alert tone="danger" title="Couldn't load more customers">
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={items}
        rowKey={rowKeyOf}
        rowLink={(row) => (row.id ? `/admin/customers/${row.id}` : null)}
        ariaLabel="Customers"
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loading}
        loadMoreLabel={error ? "Try again" : "Load more customers"}
        emptyTitle="No customers found"
        emptyDescription="Try adjusting the search."
      />
    </div>
  );
}