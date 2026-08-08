import { DataTable, StatusBadge } from "@/components/admin";
import { EmptyState, Price } from "@/components/ui";
import { formatDateTime, orderStatusMeta } from "@/lib/format";
import type { OrderLineSummaryDTO, OrderListItemDTO } from "@/types/api";

function itemsSummary(lines: OrderLineSummaryDTO[]): string {
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (lines.length === 1) return `${lines[0].productName} × ${lines[0].quantity}`;
  const first = lines[0]?.productName ?? "Items";
  return `${totalQuantity} items — ${first} +${lines.length - 1} more`;
}

/**
 * Customer purchase history (Milestone 5 — customers-screen-agent).
 * Server-rendered rows from getCustomerAdminAction's `orders` (up to 50);
 * each row links to the admin order detail owned by orders-screen-agent.
 */
export function PurchaseHistoryTable({ orders }: { orders: OrderListItemDTO[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="This customer hasn't placed any orders."
      />
    );
  }

  return (
    <DataTable
      columns={[
        {
          key: "number",
          header: "Order",
          render: (order) => <span className="font-medium text-ink">{order.number}</span>,
        },
        {
          key: "createdAt",
          header: "Date",
          render: (order) => formatDateTime(order.createdAt),
        },
        {
          key: "items",
          header: "Items",
          render: (order) => <span className="line-clamp-1">{itemsSummary(order.items)}</span>,
        },
        {
          key: "totalCents",
          header: "Total",
          className: "text-right",
          render: (order) => <Price cents={order.totalCents} size="sm" />,
        },
        {
          key: "status",
          header: "Status",
          render: (order) => <StatusBadge meta={orderStatusMeta(order.status)} />,
        },
      ]}
      data={orders}
      rowKey={(order) => order.id}
      rowLink={(order) => `/admin/orders/${order.id}`}
    />
  );
}