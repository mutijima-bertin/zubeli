import { formatRWF } from "@/lib/format";
import { cx } from "./utils";

export type PriceSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<PriceSize, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-lg font-semibold",
  xl: "text-2xl font-bold",
};

/**
 * Money display. `cents` are integer minor units (1 RWF = 1 unit) —
 * always render through this component or `formatRWF` — never hand-format.
 * `strike` renders a line-through variant for was/now pricing.
 */
export function Price({
  cents,
  currency = "RWF",
  size = "md",
  strike = false,
  className,
}: {
  cents: number;
  currency?: string;
  size?: PriceSize;
  strike?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        sizeClasses[size],
        strike && "text-stone-400 line-through",
        className,
      )}
    >
      {formatRWF(cents, currency)}
    </span>
  );
}