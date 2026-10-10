/**
 * Sales analytics — dashboard KPIs, monthly revenue, top products, period report.
 * Revenue = orders in {PAID, FULFILLED} (payment confirmed). Aggregations that
 * need column arithmetic (SUM(unitPriceCents × quantity)) use raw SQL — allowed
 * by postgres-patterns for complex reports.
 */
import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../db';
import { BUSINESS_TIME_ZONE, businessMonthKey, businessMonthRange, businessNow } from '../time';

const PAID_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];

export type OverviewKpis = {
  totalRevenueCents: number;
  orderCount: number;
  avgOrderValueCents: number;
  lowStockCount: number;
  pendingPaymentCount: number;
};

export async function overviewKpis(): Promise<OverviewKpis> {
  const [revenueAgg, orderCount, paidOrderCount, pendingPaymentCount, lowStockRows] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: PAID_STATUSES } },
      _sum: { totalCents: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: PAID_STATUSES } } }),
    prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM "Product"
      WHERE "stockQty" <= "lowStockThreshold" AND "deletedAt" IS NULL
    `,
  ]);

  const totalRevenueCents = revenueAgg._sum.totalCents ?? 0;

  return {
    totalRevenueCents,
    orderCount,
    avgOrderValueCents: paidOrderCount > 0 ? Math.round(totalRevenueCents / paidOrderCount) : 0,
    lowStockCount: lowStockRows[0]?.count ?? 0,
    pendingPaymentCount,
  };
}

export type MonthlyRevenue = {
  month: string; // 'YYYY-MM'
  revenueCents: number;
  orderCount: number;
};

/**
 * Revenue per calendar month (PAID + FULFILLED), last `months` months,
 * gap-filled. Month boundaries come from src/lib/time.ts (Africa/Kigali), so
 * the buckets do not shift with the server's timezone — the runtime is UTC in
 * production. One `now` snapshot is threaded through the whole computation so
 * the 12 keys cannot straddle a month boundary.
 *
 * `"createdAt"` is a UTC wall clock (timestamp WITHOUT time zone), so the
 * bucket expression projects it into business time before truncating; without
 * that an order placed at 01:00 Kigali on the 1st (22:00 UTC on the last day of
 * the previous month) would be counted in the wrong month.
 */
export async function revenueByMonth(months = 12): Promise<MonthlyRevenue[]> {
  const now = businessNow();
  const windowStart = businessMonthRange(months - 1, now).from;

  const rows = await prisma.$queryRaw<{ month: string; revenueCents: number; orderCount: number }[]>(
    Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TIME_ZONE}), 'YYYY-MM') AS month,
             SUM("totalCents")::int AS "revenueCents",
             COUNT(*)::int AS "orderCount"
      FROM "Order"
      WHERE status IN ('PAID', 'FULFILLED') AND "createdAt" >= ${windowStart}
      GROUP BY 1
      ORDER BY 1
    `,
  );

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const result: MonthlyRevenue[] = [];
  for (let i = 0; i < months; i++) {
    // i = 0 is the oldest bucket, i = months-1 is the current business month.
    const key = businessMonthKey(businessMonthRange(months - 1 - i, now).from);
    const row = byMonth.get(key);
    result.push(row ?? { month: key, revenueCents: 0, orderCount: 0 });
  }
  return result;
}

export type TopProduct = {
  productId: string | null;
  productName: string | null;
  revenueCents: number;
  unitsSold: number;
};

/** Best-selling products by revenue (PAID + FULFILLED orders, optional date range). */
export async function topProducts(limit = 5, from?: Date, to?: Date): Promise<TopProduct[]> {
  const fromClause = from ? Prisma.sql`AND o."createdAt" >= ${from}` : Prisma.empty;
  const toClause = to ? Prisma.sql`AND o."createdAt" <= ${to}` : Prisma.empty;

  return prisma.$queryRaw<TopProduct[]>(
    Prisma.sql`
      SELECT oi."productId" AS "productId",
             p.name AS "productName",
             SUM(oi."unitPriceCents" * oi.quantity)::int AS "revenueCents",
             SUM(oi.quantity)::int AS "unitsSold"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Product" p ON p.id = oi."productId"
      WHERE o.status IN ('PAID', 'FULFILLED') AND oi."productId" IS NOT NULL ${fromClause} ${toClause}
      GROUP BY oi."productId", p.name
      ORDER BY "revenueCents" DESC
      LIMIT ${Math.max(1, Math.trunc(limit))}
    `,
  );
}

export type PeriodReport = {
  from: Date;
  to: Date;
  revenueCents: number;
  orderCount: number;
  paidOrderCount: number;
  cancelledCount: number;
  avgOrderValueCents: number;
  unitsSold: number;
  newCustomerCount: number;
};

export async function periodReport({ from, to }: { from: Date; to: Date }): Promise<PeriodReport> {
  const rangeWhere = { createdAt: { gte: from, lte: to } };

  const [revenueAgg, orderCount, paidOrderCount, cancelledCount, newCustomerCount, unitsRows] =
    await Promise.all([
      prisma.order.aggregate({
        where: { ...rangeWhere, status: { in: PAID_STATUSES } },
        _sum: { totalCents: true },
      }),
      prisma.order.count({ where: rangeWhere }),
      prisma.order.count({ where: { ...rangeWhere, status: { in: PAID_STATUSES } } }),
      prisma.order.count({ where: { ...rangeWhere, status: OrderStatus.CANCELLED } }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`
          SELECT COALESCE(SUM(oi.quantity), 0)::int AS count
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE o.status IN ('PAID', 'FULFILLED')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        `,
      ),
    ]);

  const revenueCents = revenueAgg._sum.totalCents ?? 0;

  return {
    from,
    to,
    revenueCents,
    orderCount,
    paidOrderCount,
    cancelledCount,
    avgOrderValueCents: paidOrderCount > 0 ? Math.round(revenueCents / paidOrderCount) : 0,
    unitsSold: unitsRows[0]?.count ?? 0,
    newCustomerCount,
  };
}
