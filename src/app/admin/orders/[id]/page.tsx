import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderAdminAction } from '@/actions/admin/orders';
import { StatusBadge } from '@/components/admin';
import { Alert, Button, Card, CardBody, CardHeader, IconArrowRight, Price, Table } from '@/components/ui';
import { formatDateTime, orderStatusMeta, paymentMethodMeta, paymentStatusMeta } from '@/lib/format';
import type { OrderDTO } from '@/types/api';
import { OrderTimeline } from './_components/OrderTimeline';
import { StatusActions } from './_components/StatusActions';

export const metadata: Metadata = {
  title: 'Order details | Admin | Zubeli',
  description: 'Zubeli order detail — items, totals, payment, customer and status actions.',
};

/**
 * Admin order detail (Milestone 5 — orders-screen-agent). Server shell:
 * getOrderAdminAction → NOT_FOUND is a proper notFound(); anything else
 * renders an inline error with a way back. The status-actions strip is the
 * only client island (confirm/fulfil/cancel/refund via server actions).
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getOrderAdminAction({ orderId: id });

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') {
      notFound();
    }
    return (
      <div className="space-y-4">
        <BackToOrders />
        <Alert tone="danger" title="Couldn't load this order">
          {result.error.message}
        </Alert>
        <Button href="/admin/orders" variant="outline">
          Back to orders
        </Button>
      </div>
    );
  }

  return <OrderDetail order={result.data} />;
}

function BackToOrders() {
  return (
    <Link
      href="/admin/orders"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-ink"
    >
      <IconArrowRight className="size-4 rotate-180" />
      Orders
    </Link>
  );
}

function OrderDetail({ order }: { order: OrderDTO }) {
  const status = orderStatusMeta(order.status);
  const method = paymentMethodMeta(order.method);
  const payment = order.payment ? paymentStatusMeta(order.payment.status) : null;

  return (
    <div className="space-y-6">
      <BackToOrders />

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Order {order.number}
        </h1>
        <StatusBadge meta={status} />
        {payment && <StatusBadge meta={payment} />}
        <StatusBadge meta={method} />
      </div>
      <p className="-mt-4 text-sm text-stone-600">Placed {formatDateTime(order.createdAt)}</p>

      <StatusActions orderId={order.id} status={order.status} orderNumber={order.number} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                    <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {order.items.map((item) => (
                    <Table.Row key={item.id}>
                      <Table.Cell className="font-medium text-ink">{item.productName}</Table.Cell>
                      <Table.Cell className="text-right text-stone-600">{item.quantity}</Table.Cell>
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

          {/* Timeline */}
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
              <h2 className="text-base font-semibold text-ink">Totals</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Subtotal</dt>
                  <dd className="font-medium text-ink">
                    <Price cents={order.subtotalCents} currency={order.currency} size="sm" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Delivery fee</dt>
                  <dd className="font-medium text-ink">
                    <Price cents={order.deliveryFeeCents} currency={order.currency} size="sm" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-stone-100 pt-2">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-semibold text-ink">
                    <Price cents={order.totalCents} currency={order.currency} size="md" />
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Payment</h2>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge meta={method} />
                {payment && <StatusBadge meta={payment} />}
              </div>

              {order.payment && (
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Amount</dt>
                    <dd className="font-medium text-ink">
                      <Price cents={order.payment.amountCents} currency={order.payment.currency} size="sm" />
                    </dd>
                  </div>
                  {order.payment.confirmedAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Confirmed</dt>
                      <dd className="text-ink">{formatDateTime(order.payment.confirmedAt)}</dd>
                    </div>
                  )}
                </dl>
              )}

              {order.method === 'BANK_TRANSFER' && order.bankTransferReference && (
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-medium text-stone-500">Bank transfer reference</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
                    {order.bankTransferReference}
                  </p>
                  {order.status === 'PENDING' && (
                    <p className="mt-1.5 text-xs text-stone-600">
                      Awaiting this transfer before the payment can be confirmed.
                    </p>
                  )}
                </div>
              )}

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

          {/* Customer */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Customer</h2>
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
                    {order.customerCity ? `, ${order.customerCity}` : ''}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Delivery</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500">City</dt>
                  <dd className="text-ink">{order.customerCity ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Address</dt>
                  <dd className="text-ink">{order.customerAddress}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}