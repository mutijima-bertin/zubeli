import { cx } from "./utils";

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "info" | "warning";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  brand: "bg-brand-100 text-brand-900",
  success: "bg-success-100 text-success-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-sky-100 text-sky-800",
  warning: "bg-amber-100 text-amber-800",
};

/**
 * Small status chip. Tones pair with format.ts status maps — screens pass
 * `orderStatusMeta(status).tone` and the copy from the same map.
 */
export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}