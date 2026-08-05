/**
 * Sales analytics — thin wrappers over the db/sales queries (dashboard).
 * Revenue = PAID + FULFILLED orders only (PENDING is not revenue, ADR 0004).
 */
import 'server-only';
import { overviewKpis, periodReport, revenueByMonth, topProducts } from '@/lib/db/sales';

export function getOverviewKpis() {
  return overviewKpis();
}

export function getRevenueByMonth(months = 12) {
  return revenueByMonth(months);
}

export function getTopProducts(limit = 5, from?: Date, to?: Date) {
  return topProducts(limit, from, to);
}

export function getPeriodReport(range: { from: Date; to: Date }) {
  return periodReport(range);
}
