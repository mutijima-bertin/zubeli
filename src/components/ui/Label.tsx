import { cx } from "./utils";

export function Label({
  className,
  children,
  required,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cx("mb-1 block text-sm font-medium text-ink", className)} {...rest}>
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger-600">
          *
        </span>
      )}
    </label>
  );
}