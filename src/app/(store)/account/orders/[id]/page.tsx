import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMyOrderAction } from "@/actions/account";
import { getSession } from "@/lib/auth/session";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  IconArrowRight,
  Price,
  Table,
} from "@/components/ui";
import {
  formatDateTime,
  orderStatusMeta,
  paymentMethodMeta,
  paymentStatusMeta,
} from "@/lib/format";
import type { OrderDTO } from "@/types/api";
import { OrderTimeline } from "./_components/OrderTimeline";

export const metadata: Metadata = {
  title: "Order details | Zubeli",
  description:
    "Your Zubeli order — items, totals, payment instructions and delivery details.",
};

/**
 * Order detail (Phase C-5 — account-agent). Server shell: getMyOrderAction
 * carries the IDOR check (order must belong to the session user); anything
 * that isn't the caller's order → notFound(). Renders the OrderDTO detail:
 * items + totals, payment method/status + payment instructions, the status
 * timeline and the delivery address snapshot.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/account/orders/${id}`);

  const result = await getMyOrderAction({ orderId: id });

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "NOT_AUTHORIZED") {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <BackToOrders />
        <div className="mt-6 space-y-4">
          <Alert tone="danger" title="Couldn't load this order">
            {result.error.message}
          </Alert>
          <Button href="/account/orders" variant="outline">
            Back to order history
          </Button>
        </div>
      </div>
    );
  }

  return <OrderDetail order={result.data} />;
}

function BackToOrders() {
  return (
    <Link
      href="/account/orders"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-ink"
    >
      <IconArrowRight className="size-4 rotate-180" />
      Order history
    </Link>
  );
}

function OrderDetail({ order }: { order: OrderDTO }) {
  const status = orderStatusMeta(order.status);
  const payment = order.payment ? paymentStatusMeta(order.payment.status) : null;
  const method = paymentMethodMeta(order.method);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <BackToOrders />

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Order {order.number}
        </h1>
        <Badge tone={status.tone}>{status.label}</Badge>
        {payment && <Badge tone={payment.tone}>{payment.label}</Badge>}
      </div>
      <p className="mt-1 text-sm text-stone-600">Placed {formatDateTime(order.createdAt)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Items</h2>
            </CardHeader>
            <CardBody>
              <Table.Container>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Product</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Unit price</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Line total</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {order.items.map((item) => (
                    <Table.Row key={item.id}>
                      <Table.Cell className="font-medium text-ink">
                        {item.productName}
                      </Table.Cell>
                      <Table.Cell className="text-right">{item.quantity}</Table.Cell>
                      <Table.Cell className="text-right">
                        <Price cents={item.unitPriceCents} size="sm" />
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">
                        <Price cents={item.lineTotalCents} size="sm" />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Container>
            </CardBody>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Order status</h2>
            </CardHeader>
            <CardBody>
              <OrderTimeline order={order} />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
          {/* Totals */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Order summary</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Subtotal</dt>
                  <dd className="font-medium text-ink">
                    <Price cents={order.subtotalCents} size="sm" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Delivery fee</dt>
                  <dd className="font-medium text-ink">
                    <Price cents={order.deliveryFeeCents} size="sm" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-stone-100 pt-2">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-semibold text-ink">
                    <Price cents={order.totalCents} size="md" />
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Payment method + instructions */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Payment</h2>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={method.tone}>{method.label}</Badge>
                {payment && <Badge tone={payment.tone}>{payment.label}</Badge>}
              </div>

              {order.paymentInstructions && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <h3 className="text-sm font-semibold text-ink">
                    {order.paymentInstructions.title}
                  </h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-600">
                    {order.paymentInstructions.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Delivery snapshot */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Delivery details</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500">Name</dt>
                  <dd className="font-medium text-ink">{order.customerName}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Phone</dt>
                  <dd className="text-ink">{order.customerPhone}</dd>
                </div>
                {order.customerEmail && (
                  <div>
                    <dt className="text-stone-500">Email</dt>
                    <dd className="text-ink">{order.customerEmail}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-stone-500">Address</dt>
                  <dd className="text-ink">
                    {order.customerAddress}
                    {order.customerCity ? `, ${order.customerCity}` : ""}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
