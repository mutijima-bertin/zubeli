import { forwardRef } from "react";
import { cx } from "./utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        "block min-h-28 w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-stone-400 transition-colors focus:outline-none focus:ring-2",
        invalid
          ? "border-danger-500 focus:border-danger-600 focus:ring-danger-100"
          : "border-stone-300 focus:border-brand-600 focus:ring-brand-100",
        className,
      )}
      {...rest}
    />
  );
});