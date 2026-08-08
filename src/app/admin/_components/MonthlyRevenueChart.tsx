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

/**
 * Pure-CSS revenue bars (sales-agent). No chart library in the MVP: bar
 * heights are proportional to the month's revenue (0-revenue months get a
 * stub), the month label sits under each bar, and the exact amount + order
 * count is exposed via `title` (hover) and an sr-only line for screen
 * readers. Server-safe — rendering only, no interactivity.
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
            <span aria-hidden="true" className="text-[11px] font-medium text-stone-500">
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}