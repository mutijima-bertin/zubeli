"use client";
import { QuantityStepper } from "@/components/ui";

/**
 * Quantity picker — controlled wrapper around the shared QuantityStepper,
 * capped at the product's live stock (the server caps again on add; the
 * stepper boundary is UX only). Disabled entirely when out of stock or
 * while an add is in flight, so the boundary state is visible, not a
 * dead-end interaction.
 */
export function QuantityPicker({
  value,
  onChange,
  max,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Stock cap (QuantityStepper emits min 1 / max stock). */
  max: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-ink">Quantity</span>
      <QuantityStepper
        value={value}
        onChange={onChange}
        min={1}
        max={max}
        disabled={disabled}
      />
    </div>
  );
}
