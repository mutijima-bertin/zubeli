import { cx } from "@/components/ui";
import { formatRWF } from "@/lib/format";
import type { MonthlyRevenueDTO } from "@/types/api";

const MAX_BAR_HEIGHT = 136;

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short" });

/** "2026-08" → "Aug" (built from parts so it is timezone-safe). */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map((part) => Number(part));
  return MONTH_LABEL.format(new Date(year, (month ?? 1) - 1, 1));
}

/** "2026-08" → "Aug '26" — year-aware axis label, same timezone-safe parts. */
function monthAxisLabel(key: string): string {
  const [year, month] = key.split("-").map((part) => Number(part));
  const yy = String(year ?? 1).slice(-2);
  return `${MONTH_LABEL.format(new Date(year, (month ?? 1) - 1, 1))} '${yy}`;
}

/** Drop a trailing ".0" from a fixed-decimal string ("1.0" → "1"). */
function trimZero(value: string): string {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

/**
 * Compact RWF for direct bar labels ("12,500,000" → "12.5M", "12,500" →
 * "12.5K"). Full precision stays in the hover `title` and sr-only line.
 */
function compactRWF(cents: number): string {
  const value = Math.trunc(cents);
  if (Math.abs(value) >= 1_000_000) {
    return `${trimZero((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${trimZero((value / 1_000).toFixed(1))}K`;
  }
  return String(value);
}

/**
 * Pure-CSS revenue bars (sales-agent). No chart library in the MVP: bar
 * heights are proportional to the month's revenue (0-revenue months get a
 * stub). Chart v2 (audit item #4): each bar carries a direct compact value
 * label ≥sm, and axis labels are year-aware ("Aug '26") at md+ — below md
 * the 12 columns are too narrow for the year, so they fall back to
 * month-only. The exact amount + order count remains available via `title`
 * (hover) and an sr-only line for screen readers. Server-safe — rendering
 * only, no interactivity.
 */
export function MonthlyRevenueChart({ months }: { months: MonthlyRevenueDTO[] }) {
  if (months.length === 0) return null;

  const maxRevenue = Math.max(1, ...months.map((month) => month.revenueCents));

  return (
    <ul className="flex h-48 items-end gap-1.5 sm:gap-3">
      {months.map((month) => {
        const ratio = month.revenueCents > 0 ? month.revenueCents / maxRevenue : 0;
        const heightPx = ratio === 0 ? 3 : Math.max(6, Math.round(ratio * MAX_BAR_HEIGHT));
        const label = monthLabel(month.month);
        const year = month.month.slice(0, 4);
        const orders = `${month.orderCount} ${month.orderCount === 1 ? "order" : "orders"}`;
        return (
          <li
            key={month.month}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 self-stretch"
          >
            <span className="sr-only">
              {label} {year}: {formatRWF(month.revenueCents)}, {orders}
            </span>
            <span
              aria-hidden="true"
              className="hidden text-xs font-medium tabular-nums text-stone-600 sm:block"
            >
              {compactRWF(month.revenueCents)}
            </span>
            <div
              aria-hidden="true"
              className="w-full max-w-9"
              title={`${label} ${year} — ${formatRWF(month.revenueCents)} · ${orders}`}
            >
              <div
                className={cx(
                  "w-full rounded-t-md",
                  month.revenueCents > 0 ? "bg-brand-600" : "bg-stone-200",
                )}
                style={{ height: `${heightPx}px` }}
              />
            </div>
            <span aria-hidden="true" className="text-xs font-medium text-stone-500 md:hidden">
              {label}
            </span>
            <span aria-hidden="true" className="hidden text-xs font-medium text-stone-500 md:block">
              {monthAxisLabel(month.month)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}