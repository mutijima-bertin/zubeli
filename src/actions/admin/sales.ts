'use server';
/**
 * Admin sales actions (dashboard analytics). Revenue = PAID + FULFILLED
 * orders only (PENDING is not revenue, ADR 0004).
 */
import { revenueMonthsSchema, salesPeriodSchema, topProductsSchema } from '@/lib/validation/orders';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { getOverviewKpis, getPeriodReport, getRevenueByMonth, getTopProducts } from '@/lib/sales';
import { siteConfig } from '@/lib/site';
import { toActionResult } from '@/lib/errors';
import { toDashboardKpiDTO, toMonthlyRevenueDTO, toSalesOverviewDTO, toTopProductDTO } from '@/lib/dto';
import type { ActionResult, DashboardKpiDTO, MonthlyRevenueDTO, SalesOverviewDTO, TopProductDTO } from '@/types/api';

export async function getOverviewAction(): Promise<ActionResult<DashboardKpiDTO>> {
  try {
    await requireAdminOrThrow();
    const kpis = await getOverviewKpis();
    return { ok: true, data: toDashboardKpiDTO(kpis, siteConfig.currency) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getRevenueByMonthAction(input: unknown): Promise<ActionResult<{ months: MonthlyRevenueDTO[] }>> {
  try {
    await requireAdminOrThrow();
    const { months } = revenueMonthsSchema.parse(input);
    const rows = await getRevenueByMonth(months);
    return { ok: true, data: { months: rows.map(toMonthlyRevenueDTO) } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getTopProductsAction(input: unknown): Promise<ActionResult<{ products: TopProductDTO[] }>> {
  try {
    await requireAdminOrThrow();
    const { limit } = topProductsSchema.parse(input);
    const rows = await getTopProducts(limit);
    return { ok: true, data: { products: rows.map(toTopProductDTO) } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getPeriodReportAction(input: unknown): Promise<ActionResult<SalesOverviewDTO>> {
  try {
    await requireAdminOrThrow();
    const { from, to } = salesPeriodSchema.parse(input);
    const report = await getPeriodReport({ from, to });
    return { ok: true, data: toSalesOverviewDTO(report, siteConfig.currency) };
  } catch (error) {
    return toActionResult(error);
  }
}
