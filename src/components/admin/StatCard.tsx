import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { cx } from "@/components/ui";
import type { StatusTone } from "@/lib/format";
import { IconChevronRight } from "./icons";

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
  /**
   * Make the WHOLE card a CTA link (native anchor). When set, the card
   * renders as a `next/link` with hover lift + a slide-in chevron, and an
   * accessible name of `${title} — open ${href}`. Omit for a plain card.
   */
  href?: string;
  className?: string;
};

/**
 * Scannable dashboard KPI. Label + large value + optional trend, with an
 * icon chip. Pure presentational — screens pass plain data only.
 *
 * Pass `href` to turn the whole card into a link (e.g. actionable KPIs on
 * the overview): same layout/styling, plus a chevron that slides in on
 * hover/focus-visible and a subtle border+shadow lift. The global
 * `:focus-visible` outline (globals.css) applies on keyboard focus.
 */
export function StatCard({
  title,
  value,
  format,
  delta,
  deltaTone = "neutral",
  icon,
  tone = "neutral",
  href,
  className,
}: StatCardProps) {
  const display = format ? format(value) : String(value);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-ink tabular-nums">
            {display}
          </p>
        </div>

        {href ? (
          <span className="flex shrink-0 items-center gap-2">
            {icon && (
              <span
                className={cx(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  iconChip[tone],
                )}
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <IconChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 -translate-x-1 text-stone-400 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            />
          </span>
        ) : (
          icon && (
            <span
              className={cx(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                iconChip[tone],
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          )
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
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${title} — open ${href}`}
        className={cx(
          "group block rounded-xl border border-stone-200 bg-white p-5 shadow-card transition-all duration-150 hover:border-stone-300 hover:shadow-pop focus-visible:border-brand-500",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <Card className={cx("p-5", className)}>{content}</Card>;
}