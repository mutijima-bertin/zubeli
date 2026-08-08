"use client";
import { Button } from "./Button";
import { cx } from "./utils";

/**
 * Cursor "load more" button (ADR 0004 pagination). Screens keep their item
 * lists and append `page.nextCursor` from the fetch; this renders the
 * trigger + pending state, and the end-of-list notice.
 */
export function PaginationLoadMore({
  hasMore,
  loading = false,
  onLoadMore,
  label = "Load more",
  endLabel = "You have seen everything",
  className,
}: {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  label?: string;
  endLabel?: string | null;
  className?: string;
}) {
  if (!hasMore) {
    if (!endLabel) return null;
    return (
      <p className={cx("py-6 text-center text-sm text-stone-500", className)} aria-hidden="true">
        {endLabel}
      </p>
    );
  }
  return (
    <div className={cx("flex justify-center py-6", className)}>
      <Button
        variant="outline"
        size="md"
        onClick={onLoadMore}
        loading={loading}
        disabled={loading}
        aria-busy={loading || undefined}
      >
        {label}
      </Button>
    </div>
  );
}