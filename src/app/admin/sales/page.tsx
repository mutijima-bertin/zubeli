import type { Metadata } from "next";
import {
  getPeriodReportAction,
  getRevenueByMonthAction,
  getTopProductsAction,
} from "@/actions/admin/sales";
import { Alert, Button, EmptyState, IconCheck } from "@/components/ui";
import {
  ChartCard,
  FilterBar,
  IconChartBar,
  IconPackage,
  IconReceipt,
  IconStore,
  IconUsers,
  StatCard,
  type StatCardProps,
} from "@/components/admin";
import { formatDate, formatRWF } from "@/lib/format";
import { MonthlyRevenueChart } from "../_components/MonthlyRevenueChart";
import { TopProductsTable } from "../_components/TopProductsTable";
import { PeriodFilterForm } from "./_components/PeriodFilterForm";

export const metadata: Metadata = {
  title: "Sales reports | Zubeli",
};

type SalesSearchParams = {
  from?: string | string[];
  to?: string | string[];
};

const MONTHS_ON_CHART = 12;
const TOP_PRODUCTS_COUNT = 10;
const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Search params may be repeated (?from=a&from=b) — take the first value. */
function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Strict "YYYY-MM-DD" parse into a LOCAL date (never UTC). */
function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const match = DATE_INPUT.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return valid ? date : null;
}

/** Local date → "YYYY-MM-DD" for `<input type="date">` values. */
function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** First day → last day (23:59:59.999) of the current month. */
function currentMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

/** StatCard passes `string | number` — coerce to cents for formatRWF. */
const rwf: StatCardProps["format"] = (value) => formatRWF(Number(value));

/**
 * /admin/sales — sales reports (sales-agent).
 *
 * Server-rendered from the query string: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * drive getPeriodReportAction (default: current month). KPI cards come from
 * the report; the revenue-by-month chart and top products are global
 * (last 12 months / all time). The only client island is the period form,
 * which pushes new query params — the page then re-fetches server-side.
 */
export default async function SalesReportsPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearchParams>;
}) {
  const params = await searchParams;
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();

  let from = parseDateInput(firstParam(params.from)) ?? defaultFrom;
  let to = parseDateInput(firstParam(params.to)) ?? defaultTo;
  if (from.getTime() > to.getTime()) {
    from = defaultFrom;
    to = defaultTo;
  }

  const [report, revenue, top] = await Promise.all([
    getPeriodReportAction({ from: from.toISOString(), to: to.toISOString() }),
    getRevenueByMonthAction({ months: MONTHS_ON_CHART }),
    getTopProductsAction({ limit: TOP_PRODUCTS_COUNT }),
  ]);

  const months = revenue.ok ? revenue.data.months : [];
  const hasRevenue = months.some((month) => month.revenueCents > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Sales reports
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Revenue, orders and product performance for a chosen period.
        </p>
      </div>

      <FilterBar
        title="Period"
        filters={
          <PeriodFilterForm
            from={toDateInputValue(from)}
            to={toDateInputValue(to)}
          />
        }
        summary={
          report.ok
            ? `${formatDate(report.data.periodStart)} — ${formatDate(report.data.periodEnd)}`
            : undefined
        }
      />

      {!report.ok ? (
        <Alert tone="danger" title="Couldn't load the sales report">
          {report.error.message}
          <div className="mt-3">
            <Button href="/admin/sales" variant="outline" size="sm">
              Try again
            </Button>
          </div>
        </Alert>
      ) : report.data.ordersCount === 0 ? (
        <EmptyState
          title="No orders in this period"
          description="Try a wider date range — revenue counts paid and fulfilled orders only."
          action={
            <Button href="/admin/orders" variant="outline">
              View all orders
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Revenue"
            value={report.data.totalRevenueCents}
            format={rwf}
            tone="brand"
            icon={<IconChartBar className="size-5" />}
          />
          <StatCard
            title="Orders"
            value={report.data.ordersCount}
            tone="info"
            icon={<IconReceipt className="size-5" />}
          />
          <StatCard
            title="Paid orders"
            value={report.data.paidOrdersCount}
            tone="success"
            icon={<IconCheck className="size-5" />}
          />
          <StatCard
            title="Avg order value"
            value={report.data.averageOrderValueCents}
            format={rwf}
            icon={<IconStore className="size-5" />}
          />
          <StatCard
            title="Units sold"
            value={report.data.unitsSold ?? 0}
            icon={<IconPackage className="size-5" />}
          />
          <StatCard
            title="New customers"
            value={report.data.newCustomerCount ?? 0}
            icon={<IconUsers className="size-5" />}
          />
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

      <ChartCard
        title="Top products"
        description="By revenue · paid and fulfilled orders"
        bodyMinHeightClassName="min-h-72"
      >
        {!top.ok ? (
          <Alert tone="danger" title="Couldn't load top products">
            {top.error.message}
          </Alert>
        ) : (
          <TopProductsTable products={top.data.products} />
        )}
      </ChartCard>
    </div>
  );
}