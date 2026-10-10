/**
 * Order-confirmation screen (Phase C-4 — checkout-agent). Rendered by
 * success/page.tsx from getCheckoutOrderAction data (public lookup —
 * Decision A), so a hard refresh of /checkout/success?order=<id> always
 * re-fetches the same confirmation. Server-compatible (no "use client"):
 * the success toast is fired by CheckoutFlow before navigating here.
 *
 * Shows: order number + PENDING status, payment method/status badges, the
 * provider payment instructions, the order summary, and CTAs (continue
 * browsing + view orders for signed-in customers).
 */
import { Badge, Button, Card, CardBody, CardHeader, IconCheck, Price, Table } from "@/components/ui";
import { formatDateTime, orderStatusMeta, paymentMethodMeta, paymentStatusMeta } from "@/lib/format";
import type { OrderDTO, PaymentInstructions } from "@/types/api";
import { PaymentInstructionsPanel } from "./PaymentInstructionsPanel";

export function SuccessScreen({
  order,
  paymentInstructions,
  isSignedIn,
}: {
  order: OrderDTO;
  paymentInstructions: PaymentInstructions;
  isSignedIn: boolean;
}) {
  const status = orderStatusMeta(order.status);
  const method = paymentMethodMeta(order.method);
  const payment = order.payment ? paymentStatusMeta(order.payment.status) : null;

  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="flex flex-col items-center text-center">
        <span
          className="flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600"
          aria-hidden="true"
        >
          <IconCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Order confirmed
        </h1>
        <p className="mt-2 text-sm text-stone-600 sm:text-base">
          {firstName ? `Thanks ${firstName} — ` : "Thanks — "}
          we&apos;ve got your order. We&apos;ll call{" "}
          <span className="font-medium text-ink">{order.customerPhone}</span> to confirm delivery.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="neutral">Order {order.number}</Badge>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={method.tone}>{method.label}</Badge>
          {payment && <Badge tone={payment.tone}>{payment.label}</Badge>}
        </div>
      </div>

      <div className="mt-10 space-y-6">
        <PaymentInstructionsPanel instructions={paymentInstructions} />

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-ink">Order summary</h2>
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
                    <Table.Cell className="font-medium text-ink">{item.productName}</Table.Cell>
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

            <dl className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Subtotal</dt>
                <dd className="font-medium text-ink">
                  <Price cents={order.subtotalCents} size="sm" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-stone-100 pt-2">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-semibold text-ink">
                  <Price cents={order.totalCents} size="md" />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-stone-500">
              Placed {formatDateTime(order.createdAt)} · All prices include VAT.
            </p>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="/products" size="lg" fullWidth>
            Continue browsing
          </Button>
          {isSignedIn && (
            <Button href="/account/orders" variant="outline" size="lg" fullWidth>
              View your orders
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
