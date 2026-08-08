import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getOverviewAction,
  getRevenueByMonthAction,
  getTopProductsAction,
} from "@/actions/admin/sales";
import { listOrdersAdminAction } from "@/actions/admin/orders";
import { Alert, Button, EmptyState } from "@/components/ui";
import {
  ChartCard,
  IconChartBar,
  IconInventory,
  IconReceipt,
  IconStore,
  StatCard,
  type StatCardProps,
} from "@/components/admin";
import { formatRWF } from "@/lib/format";
import { MonthlyRevenueChart } from "./_components/MonthlyRevenueChart";
import { RecentOrdersCard } from "./_components/RecentOrdersCard";
import { TopProductsTable } from "./_components/TopProductsTable";

export const metadata: Metadata = {
  title: "Dashboard overview | Zubeli",
};

const MONTHS_ON_CHART = 12;
const TOP_PRODUCTS_COUNT = 5;
const RECENT_ORDERS_COUNT = 5;

/** StatCard passes `string | number` — coerce to cents for formatRWF. */
const rwf: StatCardProps["format"] = (value) => formatRWF(Number(value));

/** Whole-card link for actionable KPIs (low stock, pending payments). */
function KpiLink({
  href,
  srLabel,
  children,
}: {
  href: string;
  srLabel: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="block rounded-xl">
      {children}
      <span className="sr-only">{srLabel}</span>
    </Link>
  );
}

/**
 * /admin — dashboard overview (sales-agent).
 *
 * Server-rendered: KPIs + 12-month revenue bars + top products + a recent
 * orders quick-list, all fetched in parallel via the admin actions. Each
 * block degrades independently (inline Alert + retry) so one failure never
 * blanks the whole dashboard.
 */
export default async function AdminDashboardPage() {
  const [overview, revenue, top, recent] = await Promise.all([
    getOverviewAction(),
    getRevenueByMonthAction({ months: MONTHS_ON_CHART }),
    getTopProductsAction({ limit: TOP_PRODUCTS_COUNT }),
    listOrdersAdminAction({ limit: RECENT_ORDERS_COUNT }),
  ]);

  const months = revenue.ok ? revenue.data.months : [];
  const hasRevenue = months.some((month) => month.revenueCents > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Dashboard overview
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Revenue, orders and product performance at a glance.
        </p>
      </div>

      {!overview.ok ? (
        <Alert tone="danger" title="Couldn't load KPIs">
          {overview.error.message}
          <div className="mt-3">
            <Button href="/admin" variant="outline" size="sm">
              Try again
            </Button>
          </div>
        </Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Total revenue"
            value={overview.data.totalRevenueCents}
            format={rwf}
            tone="brand"
            icon={<IconChartBar className="size-5" />}
          />
          <StatCard
            title="Orders"
            value={overview.data.orderCount}
            tone="info"
            icon={<IconReceipt className="size-5" />}
          />
          <StatCard
            title="Avg order value"
            value={overview.data.avgOrderValueCents}
            format={rwf}
            icon={<IconStore className="size-5" />}
          />
          <KpiLink href="/admin/stock" srLabel="View stock levels">
            <StatCard
              title="Low stock"
              value={overview.data.lowStockCount}
              tone="danger"
              icon={<IconInventory className="size-5" />}
              className="h-full transition-colors hover:border-brand-600"
            />
          </KpiLink>
          <KpiLink href="/admin/orders" srLabel="View orders awaiting payment">
            <StatCard
              title="Pending payments"
              value={overview.data.pendingPaymentCount}
              tone="warning"
              icon={<IconReceipt className="size-5" />}
              className="h-full transition-colors hover:border-brand-600"
            />
          </KpiLink>
        </div>
      )}

      <ChartCard
        title="Revenue by month"
        description="Paid and fulfilled orders · last 12 months"
        bodyMinHeightClassName="min-h-56"
      >
        {!revenue.ok ? (
          <Alert tone="danger" title="Couldn't load the revenue chart">
            {revenue.error.message}
          </Alert>
        ) : !hasRevenue ? (
          <EmptyState
            title="No revenue yet"
            description="Sales from paid and fulfilled orders will show up here."
          />
        ) : (
          <MonthlyRevenueChart months={months} />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Top products"
          description="By revenue · paid and fulfilled orders"
          className="lg:col-span-3"
          bodyMinHeightClassName="min-h-64"
        >
          {!top.ok ? (
            <Alert tone="danger" title="Couldn't load top products">
              {top.error.message}
            </Alert>
          ) : (
            <TopProductsTable products={top.data.products} />
          )}
        </ChartCard>
        <div className="lg:col-span-2">
          <RecentOrdersCard
            orders={recent.ok ? recent.data.items : []}
            error={recent.ok ? null : recent.error.message}
          />
        </div>
      </div>
    </div>
  );
}