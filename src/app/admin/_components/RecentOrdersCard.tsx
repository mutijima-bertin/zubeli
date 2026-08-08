import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Price,
} from "@/components/ui";
import { IconReceipt, StatusBadge } from "@/components/admin";
import { formatDate, orderStatusMeta } from "@/lib/format";
import type { OrderListItemDTO } from "@/types/api";

/**
 * "Recent orders" quick-list (sales-agent). Shows the five latest orders
 * with minimal fields (number, customer, status, total, date) and links
 * each row to the order detail; a "View all" button goes to /admin/orders.
 * Three states: rows, empty, or a fetch error — the parent page owns the
 * data fetch and passes plain props.
 */
export function RecentOrdersCard({
  orders,
  error,
}: {
  orders: OrderListItemDTO[];
  error?: string | null;
}) {
  const body = error ? (
    <Alert tone="danger" title="Couldn't load recent orders">
      {error}
    </Alert>
  ) : orders.length === 0 ? (
    <EmptyState
      icon={<IconReceipt className="size-6" />}
      title="No orders yet"
      description="Orders placed through the storefront will show up here."
    />
  ) : (
    <ul className="divide-y divide-stone-100" aria-label="Recent orders">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/admin/orders/${order.id}`}
            className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-brand-700 underline-offset-2 group-hover:underline">
                {order.number}
              </span>
              <span className="mt-0.5 block truncate text-xs text-stone-500">
                {order.customerName ?? order.customerPhone ?? "Guest"} · {formatDate(order.createdAt)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Price cents={order.totalCents} size="sm" />
              <StatusBadge meta={orderStatusMeta(order.status)} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent orders"
        description="Latest orders across the store"
      >
        <Button href="/admin/orders" variant="outline" size="sm">
          View all
        </Button>
      </CardHeader>
      <CardBody className="flex-1">{body}</CardBody>
    </Card>
  );
}