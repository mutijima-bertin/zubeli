import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export type FilterBarProps = {
  /** Optional section label on the left ("Filters" or a page-scoped label). */
  title?: ReactNode;
  /** Left slot — filter controls (Selects, search inputs, chips). */
  filters: ReactNode;
  /** Right slot — action buttons (Export, Create, Apply…). */
  actions?: ReactNode;
  /** Optional count text rendered before the actions ("12 products"). */
  summary?: ReactNode;
  className?: string;
};

/**
 * Dense filter/action toolbar for admin lists. One row on sm+ (wraps on
 * mobile). Screens own the controls inside `filters`; this component only
 * lays them out together with the actions.
 */
export function FilterBar({
  title,
  filters,
  actions,
  summary,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {title && <span className="text-sm font-semibold text-ink">{title}</span>}
        {filters}
      </div>
      {(summary || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {summary}
          {actions}
        </div>
      )}
    </div>
  );
}