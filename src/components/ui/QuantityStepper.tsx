"use client";
import { IconMinus, IconPlus } from "./icons";
import { cx } from "./utils";

/**
 * Client quantity picker bound to a product's stock cap. Emits the next
 * absolute quantity via `onChange` — screens wire it to cart actions.
 * Disabled when at min/max so the boundary state is visible, not dead-end.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const decrementDisabled = disabled || value <= min;
  const incrementDisabled = disabled || (max != null && value >= max);

  return (
    <div
      role="group"
      aria-label="Quantity"
      className={cx("inline-flex h-11 items-stretch overflow-hidden rounded-lg border border-stone-300 bg-white", className)}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={decrementDisabled}
        aria-label="Decrease quantity"
        className="flex w-11 items-center justify-center text-stone-600 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40"
      >
        <IconMinus className="size-4" strokeWidth={2.2} />
      </button>
      <span
        aria-live="polite"
        className="flex min-w-10 items-center justify-center px-2 text-sm font-semibold tabular-nums text-ink"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={incrementDisabled}
        aria-label="Increase quantity"
        className="flex w-11 items-center justify-center text-stone-600 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40"
      >
        <IconPlus className="size-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}