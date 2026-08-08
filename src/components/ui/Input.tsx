import { forwardRef } from "react";
import { cx } from "./utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Marks the field as errored: red border/ring + `aria-invalid`. */
  invalid?: boolean;
};

const baseFieldClasses =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 transition-colors focus:outline-none focus:ring-2 min-h-11";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        baseFieldClasses,
        invalid
          ? "border-danger-500 focus:border-danger-600 focus:ring-danger-100"
          : "border-stone-300 focus:border-brand-600 focus:ring-brand-100",
        className,
      )}
      {...rest}
    />
  );
});