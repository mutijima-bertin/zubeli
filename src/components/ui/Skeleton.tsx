import { cx } from "./utils";

/**
 * Grey placeholder block for loading states — prefer these over spinners
 * for lists, cards and page sections (frontend-patterns skill).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-lg bg-stone-200/80", className)}
    />
  );
}