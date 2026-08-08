import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { cx } from "@/components/ui";
import type { StatusTone } from "@/lib/format";

const iconChip: Record<StatusTone, string> = {
  neutral: "bg-stone-100 text-stone-600",
  brand: "bg-brand-100 text-brand-900",
  success: "bg-success-100 text-success-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-sky-100 text-sky-800",
  warning: "bg-amber-100 text-amber-800",
};

export type StatCardProps = {
  /** KPI label ("Revenue this month"). */
  title: string;
  /** Raw value — pass a formatter for money etc. */
  value: string | number;
  /** Value formatter, e.g. `formatRWF` from `@/lib/format`. Default `String`. */
  format?: (value: string | number) => string;
  /** Optional trend line, e.g. "+12% vs last month". */
  delta?: string;
  /** Arrow + color of the trend line. */
  deltaTone?: "up" | "down" | "neutral";
  /** Optional icon rendered in a toned chip. */
  icon?: ReactNode;
  /** Chip tone (also drives the delta arrow color family). */
  tone?: StatusTone;
  className?: string;
};

/**
 * Scannable dashboard KPI. Label + large value + optional trend, with an
 * icon chip. Pure presentational — screens pass plain data only.
 */
export function StatCard({
  title,
  value,
  format,
  delta,
  deltaTone = "neutral",
  icon,
  tone = "neutral",
  className,
}: StatCardProps) {
  const display = format ? format(value) : String(value);

  return (
    <Card className={cx("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-ink tabular-nums">
            {display}
          </p>
        </div>
        {icon && (
          <span
            className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", iconChip[tone])}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      {delta && (
        <p
          className={cx(
            "mt-2.5 flex items-center gap-1 text-sm font-medium",
            deltaTone === "up"
              ? "text-success-700"
              : deltaTone === "down"
                ? "text-danger-600"
                : "text-stone-500",
          )}
        >
          <span aria-hidden="true">
            {deltaTone === "up" ? "↑" : deltaTone === "down" ? "↓" : "•"}
          </span>
          {delta}
        </p>
      )}
    </Card>
  );
}