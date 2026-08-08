"use client";
import Link from "next/link";
import { useState } from "react";
import { getMyOrdersAction } from "@/actions/account";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  PaginationLoadMore,
  Price,
  Table,
} from "@/components/ui";
import {
  formatDateTime,
  orderStatusMeta,
  paymentMethodMeta,
  paymentStatusMeta,
} from "@/lib/format";
import type { OrderLineSummaryDTO, OrderListItemDTO } from "@/types/api";

const PAGE_SIZE = 10;

function itemsSummary(lines: OrderLineSummaryDTO[]): string {
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (lines.length === 1) return `${lines[0].productName} × ${lines[0].quantity}`;
  const first = lines[0]?.productName ?? "Items";
  return `${totalQuantity} items — ${first} +${lines.length - 1} more`;
}

/** Status + method badges — shared by the mobile card and desktop table. */
function PaymentSummary({ order }: { order: OrderListItemDTO }) {
  const payment = paymentStatusMeta(order.paymentStatus);
  const method = paymentMethodMeta(order.method);
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={payment.tone}>{payment.label}</Badge>
      <span className="text-xs text-stone-500">{method.label}</span>
    </div>
  );
}

/**
 * Order history list (Phase C-5 — account-agent). Mobile-first: the six
 * data points render as stacked cards on small screens and as a table from
 * `sm` up. Load-more appends pages via getMyOrdersAction cursor pagination;
 * a failed page keeps the list and shows a retryable error.
 */
export function OrderHistoryTable({
  initialItems,
  initialNextCursor,
  initialHasMore,
}: {
  initialItems: OrderListItemDTO[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState<OrderListItemDTO[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (loading || !nextCursor) return;
    setLoading(true);
    setError(null);
    const res = await getMyOrdersAction({ cursor: nextCursor, limit: PAGE_SIZE });
    if (res.ok) {
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
      setHasMore(res.data.hasMore);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <p role="status" className="sr-only">
        {loading ? "Loading more orders" : `Showing ${items.length} orders`}
      </p>

      {error && (
        <div className="mb-4">
          <Alert tone="danger" title="Couldn't load more orders">
            {error}
          </Alert>
        </div>
      )}

      {/* Mobile: stacked order cards */}
      <ul className="space-y-3 sm:hidden" aria-label="Orders">
        {items.map((order) => (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.id}`}
              className="block rounded-xl transition-colors"
            >
              <Card className="transition-colors hover:border-brand-600">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-ink">{order.number}</span>
                    <Badge tone={orderStatusMeta(order.status).tone}>
                      {orderStatusMeta(order.status).label}
                    </Badge>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Placed</dt>
                      <dd className="text-right text-ink">{formatDateTime(order.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Items</dt>
                      <dd className="max-w-56 text-right text-ink">
                        <span className="line-clamp-1">{itemsSummary(order.items)}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Total</dt>
                      <dd className="text-right font-medium text-ink">
                        <Price cents={order.totalCents} size="sm" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <dt className="text-stone-500">Payment</dt>
                      <dd className="text-right">
                        <PaymentSummary order={order} />
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden sm:block">
        <Table.Container>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Items</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Payment</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {items.map((order) => {
              const status = orderStatusMeta(order.status);
              return (
                <Table.Row key={order.id}>
                  <Table.Cell>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                    >
                      {order.number}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{formatDateTime(order.createdAt)}</Table.Cell>
                  <Table.Cell className="max-w-64">
                    <span className="line-clamp-1">{itemsSummary(order.items)}</span>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Price cents={order.totalCents} size="sm" />
                  </Table.Cell>
                  <Table.Cell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <PaymentSummary order={order} />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Container>
      </div>

      <PaginationLoadMore
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
        label={error ? "Try again" : "Load more orders"}
        endLabel="You've seen all your orders"
      />
    </div>
  );
}
