import type { ReactNode } from "react";
import { IconBox } from "./icons";
import { cx } from "./utils";

/**
 * Empty/zero state: icon + explanation + a clear next action
 * (ui-design-principles: "No orders yet — view your first sale").
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-white text-stone-400 shadow-card" aria-hidden="true">
        {icon ?? <IconBox className="size-6" />}
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}