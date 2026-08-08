import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo, IconWarning } from "./icons";
import { cx } from "./utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-danger-100 bg-danger-50 text-danger-700",
};

const toneIcons: Record<AlertTone, (props: { className?: string }) => ReactNode> = {
  info: (props) => <IconInfo {...props} />,
  success: (props) => <IconCheck {...props} />,
  warning: (props) => <IconAlert {...props} />,
  danger: (props) => <IconWarning {...props} />,
};

/**
 * Page-level feedback (success banner, form error summary) and the visual
 * core of Toasts. Danger defaults to `role="alert"` (assertive), the rest
 * announce politely.
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-lg border p-4 text-sm", toneClasses[tone], className)}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className={cx(title ? "mt-1" : undefined, "text-sm opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}