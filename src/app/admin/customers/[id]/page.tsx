import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCustomerAdminAction } from "@/actions/admin/customers";
import { IconChartBar, IconReceipt, IconUsers, StatCard } from "@/components/admin";
import { Alert, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { formatDate, formatRWF } from "@/lib/format";
import { PurchaseHistoryTable } from "./_components/PurchaseHistoryTable";

export const metadata: Metadata = {
  title: "Customer details | Admin | Zubeli",
  description: "Customer contact details, lifetime order totals and purchase history.",
};

/**
 * Admin customer detail — /admin/customers/[id] (Milestone 5,
 * customers-screen-agent). Server page: getCustomerAdminAction returns the
 * customer aggregates + up to 50 orders; contact card, KPI cards and the
 * purchase history table render from that one pass. Guests (id: null) are
 * never linked here, so `id` always resolves to a registered user.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCustomerAdminAction({ customerId: id });

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION") notFound();
    if (result.error.code === "NOT_AUTHORIZED") redirect("/");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Customer details</h1>
        <Alert tone="danger" title="Couldn't load this customer">
          {result.error.message}
        </Alert>
        <Button href={`/admin/customers/${id}`} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  const { customer, orders } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Button href="/admin/customers" variant="ghost" size="sm" className="-ml-3">
          ← Back to customers
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{customer.name}</h1>
        <p className="mt-1 text-sm text-stone-600">
          Registered account — contact details and lifetime order totals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Orders"
          value={customer.ordersCount}
          icon={<IconReceipt className="size-5" />}
          tone="brand"
        />
        <StatCard
          title="Total spent"
          value={customer.totalSpentCents}
          format={(value) => formatRWF(Number(value))}
          icon={<IconChartBar className="size-5" />}
          tone="success"
        />
        <StatCard
          title="Last order"
          value={formatDate(customer.lastOrderAt)}
          icon={<IconUsers className="size-5" />}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader title="Contact details" />
        <CardBody>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-stone-500">Name</dt>
              <dd className="mt-0.5 font-medium text-ink">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Email</dt>
              <dd className="mt-0.5 text-ink">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Phone</dt>
              <dd className="mt-0.5 text-ink">{customer.phone || "—"}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <section aria-labelledby="purchase-history" className="space-y-3">
        <h2 id="purchase-history" className="text-lg font-semibold text-ink">
          Purchase history
        </h2>
        <PurchaseHistoryTable orders={orders} />
      </section>
    </div>
  );
}