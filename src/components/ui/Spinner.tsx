import { cx } from "./utils";

export type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

/**
 * Loading indicator for in-flight actions. Announces itself to screen
 * readers via `role="status"` + sr-only label.
 */
export function Spinner({
  size = "md",
  label = "Loading…",
  className,
}: {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={cx("inline-flex items-center", className)}>
      <svg
        className={cx("animate-spin text-current", sizeClasses[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}