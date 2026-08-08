import type { Metadata } from 'next';
import { listOrdersAdminAction } from '@/actions/admin/orders';
import { Alert, Button } from '@/components/ui';
import type { OrderStatus, PaymentMethod } from '@/types/api';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from './_components/orders-options';
import { OrdersList } from './_components/OrdersList';

export const metadata: Metadata = {
  title: 'Orders | Admin | Zubeli',
  description:
    'Manage Zubeli orders — confirm payments, fulfil delivery, cancel and refund.',
};

type OrdersSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Admin orders list (Milestone 5 — orders-screen-agent). The URL owns the
 * filters (?status, ?method, ?q) so the page is server-rendered per filter
 * combination; the client list only appends pages via cursor load-more.
 * Auth: the admin layout already redirects non-OWNERs; every action re-runs
 * requireAdminOrThrow (defense-in-depth).
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  const sp = await searchParams;

  const rawStatus = firstParam(sp.status);
  const rawMethod = firstParam(sp.method);
  const rawQuery = (firstParam(sp.q) ?? '').trim().slice(0, 100);

  const status = ORDER_STATUS_OPTIONS.some((o) => o.value === rawStatus)
    ? (rawStatus as OrderStatus)
    : undefined;
  const method = PAYMENT_METHOD_OPTIONS.some((m) => m.value === rawMethod)
    ? (rawMethod as PaymentMethod)
    : undefined;
  const search = rawQuery || undefined;

  const filterKey = [status ?? '', method ?? '', search ?? ''].join('|');

  const result = await listOrdersAdminAction({
    status,
    paymentMethod: method,
    search,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-stone-600">
          Confirm payments, fulfil delivery and handle cancellations or refunds.
        </p>
      </div>

      {!result.ok ? (
        <div className="space-y-4">
          <Alert tone="danger" title="Couldn't load orders">
            {result.error.message}
          </Alert>
          <Button href="/admin/orders" variant="outline">
            Try again
          </Button>
        </div>
      ) : (
        <OrdersList
          key={filterKey}
          status={status}
          method={method}
          q={search}
          initialPage={result.data}
        />
      )}
    </div>
  );
}