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
import { BUSINESS_TIME_ZONE, businessMonthRange } from "@/lib/time";
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

/**
 * Wall clock of an instant in BUSINESS_TIME_ZONE. Production runs on UTC
 * (Vercel) and dev machines can be in any zone, so every calendar question
 * here is asked of the business zone — never of the runtime's local time.
 */
const BUSINESS_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type BusinessParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function businessParts(instant: Date): BusinessParts {
  const values: Record<string, number> = {};
  for (const part of BUSINESS_PARTS.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Business-zone UTC offset (ms) in effect at `instant`. */
function zoneOffsetMs(instant: Date): number {
  const p = businessParts(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/** 00:00 business time on a calendar day → the UTC instant (two-pass, DST-safe). */
function businessDayStart(year: number, month: number, day: number): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day);
  const firstPass = new Date(wallAsUtc - zoneOffsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - zoneOffsetMs(firstPass));
}

/** Instant → "YYYY-MM-DD" business day (the `<input type="date">` shape). */
function businessDayKey(instant: Date): string {
  const { year, month, day } = businessParts(instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Strict "YYYY-MM-DD" parse into 00:00 business time on that day (never UTC). */
function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const match = DATE_INPUT.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = businessDayStart(year, month, day);
  const parts = businessParts(start);
  const valid = parts.year === year && parts.month === month && parts.day === day;
  return valid ? start : null;
}

/** StatCard passes `string | number` — coerce to cents for formatRWF. */
const rwf: StatCardProps["format"] = (value) => formatRWF(Number(value));

/**
 * /admin/sales — sales reports (sales-agent).
 *
 * Server-rendered from the query string: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * drive getPeriodReportAction (default: the current business month, 1st →
 * last millisecond). Dates are read as Africa/Kigali calendar days so a UTC
 * server never books evening Kigali orders into the previous day. KPI cards
 * come from the report; the revenue-by-month chart and top products are
 * global (last 12 months / all time). The only client island is the period
 * form, which pushes new query params — the page then re-fetches server-side.
 */
export default async function SalesReportsPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearchParams>;
}) {
  const params = await searchParams;
  const { from: defaultFrom, to: defaultTo } = businessMonthRange();

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
            from={businessDayKey(from)}
            to={businessDayKey(to)}
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