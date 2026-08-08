import { forwardRef } from "react";
import { IconChevronDown } from "./icons";
import { cx } from "./utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <span className={cx("relative block w-full", className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          "block w-full appearance-none rounded-lg border bg-white py-2.5 pl-3 pr-9 text-sm text-ink transition-colors focus:outline-none focus:ring-2",
          invalid
            ? "border-danger-500 focus:border-danger-600 focus:ring-danger-100"
            : "border-stone-300 focus:border-brand-600 focus:ring-brand-100",
        )}
        {...rest}
      />
      <IconChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
        strokeWidth={2}
      />
    </span>
  );
});