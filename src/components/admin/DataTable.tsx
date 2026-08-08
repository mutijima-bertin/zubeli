import Link from "next/link";
import type { ReactNode } from "react";
import {
  Alert,
  EmptyState,
  IconBox,
  PaginationLoadMore,
  Skeleton,
  Table,
  cx,
} from "@/components/ui";
import { SortableDataTable } from "./SortableDataTable";

export type DataTableColumn<T> = {
  /** Stable key — also the default cell accessor when `render` is omitted. */
  key: string;
  header: ReactNode;
  /** Applied to the column <th> and every <td> (right-align numbers, widths). */
  className?: string;
  /** Custom cell renderer. Default: stringifies `row[key]` ("—" when null). */
  render?: (row: T) => ReactNode;
  /**
   * Enable client-side click-to-sort on this header (asc first, then
   * toggles). Purely client state — no server action or URL changes.
   * NOTE: the consuming screen must be a client component ("use client"):
   * when any column is sortable the table renders through a client
   * widget, so render/rowKey functions must not cross a server boundary.
   */
  sortable?: boolean;
  /**
   * Sort key override for the column. Default reads the same `row[key]`
   * accessor as the cell — use this for formatted/derived columns (e.g.
   * sort by the raw timestamp, not the rendered date label).
   */
  sortValue?: (row: T) => string | number;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Stable unique key per row (e.g. `row.id`, order number). */
  rowKey: (row: T) => string | number;
  /**
   * When provided, the first cell becomes a stretched link over the whole
   * row (whole row clickable, keyboard focus stays on the real anchor).
   * Return `null` for rows that must not link.
   */
  rowLink?: (row: T) => string | null;
  /** Accessible name for the table region. */
  ariaLabel?: string;

  // --- states ---
  /** Replace the (empty) body with skeleton rows. */
  loading?: boolean;
  /** Number of skeleton rows while loading (default 5). */
  skeletonRows?: number;
  /** Inline error banner rendered instead of the body. */
  error?: ReactNode;

  // --- empty state ---
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;

  // --- cursor pagination (omit `hasMore`/`onLoadMore` to hide the pager) ---
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Spinner state of the load-more button (keep old rows visible). */
  loadingMore?: boolean;
  loadMoreLabel?: string;
  /** End-of-list notice; `null` hides it (admin default). */
  loadMoreEndLabel?: string | null;

  /** Optional <tfoot> summary band spanning all columns (totals…). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Generic dense admin table. One component covers list screens: typed
 * columns with custom renders, row links, loading skeletons, inline error,
 * empty state, cursor "load more" pagination (via the design-system
 * PaginationLoadMore) and an optional totals footer.
 *
 * Screens keep ALL data fetching in their own components and pass plain
 * data — no logic lives here.
 *
 * Optional per-column client-side sorting (`sortable: true`): the widget
 * transparently delegates to a client twin (SortableDataTable) that adds
 * sort buttons, `aria-sort` and a stable sort — the public props stay the
 * same, and screens with no sortable columns keep the exact same server
 * markup (no client boundary).
 */
export function DataTable<T>(props: DataTableProps<T>) {
  if (props.columns.some((col) => col.sortable)) {
    return <SortableDataTable {...props} />;
  }
  return <DataTableCore {...props} />;
}

function DataTableCore<T>({
  columns,
  data,
  rowKey,
  rowLink,
  ariaLabel,
  loading = false,
  skeletonRows = 5,
  error,
  emptyTitle = "No records found",
  emptyDescription,
  emptyAction,
  hasMore,
  onLoadMore,
  loadingMore = false,
  loadMoreLabel,
  loadMoreEndLabel,
  footer,
  className,
}: DataTableProps<T>) {
  const showPager = typeof hasMore === "boolean" && Boolean(onLoadMore);
  const bodyColSpan = columns.length;

  function defaultCell(row: T, key: string): ReactNode {
    const raw = (row as Record<string, unknown>)[key];
    return raw == null ? "—" : String(raw);
  }

  const table = (
    <Table.Container className={cx("bg-white", className)}>
      <Table.Head>
        <Table.Row>
          {columns.map((col) => (
            <Table.HeaderCell key={col.key} className={col.className}>
              {col.header}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Head>

      <Table.Body>
        {error ? (
          <Table.Row>
            <Table.Cell colSpan={bodyColSpan} className="px-4 py-4">
              <Alert tone="danger">{error}</Alert>
            </Table.Cell>
          </Table.Row>
        ) : loading && data.length === 0 ? (
          Array.from({ length: skeletonRows }, (_, index) => (
            <Table.Row key={`skeleton-${index}`}>
              {columns.map((col) => (
                <Table.Cell key={col.key} className={col.className}>
                  <Skeleton className="h-4 w-full" />
                </Table.Cell>
              ))}
            </Table.Row>
          ))
        ) : data.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={bodyColSpan} className="px-4 py-10">
              <EmptyState
                icon={<IconBox className="size-6" />}
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
              />
            </Table.Cell>
          </Table.Row>
        ) : (
          data.map((row) => {
            const href = rowLink?.(row) ?? null;
            return (
              <Table.Row key={rowKey(row)} className={href ? "relative cursor-pointer" : undefined}>
                {columns.map((col, index) => {
                  const content = col.render ? col.render(row) : defaultCell(row, col.key);
                  if (index === 0 && href) {
                    return (
                      <Table.Cell key={col.key} className={col.className}>
                        <Link
                          href={href}
                          className="after:absolute after:inset-0"
                        >
                          {content}
                        </Link>
                      </Table.Cell>
                    );
                  }
                  return (
                    <Table.Cell key={col.key} className={col.className}>
                      {content}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })
        )}
      </Table.Body>

      {footer && (
        <tfoot>
          <tr className="bg-stone-50">
            <td colSpan={bodyColSpan} className="px-4 py-3 text-sm font-semibold text-ink">
              {footer}
            </td>
          </tr>
        </tfoot>
      )}
    </Table.Container>
  );

  return (
    <div className="space-y-4">
      {ariaLabel ? <section aria-label={ariaLabel}>{table}</section> : table}
      {showPager && (
        <PaginationLoadMore
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={() => onLoadMore?.()}
          label={loadMoreLabel}
          endLabel={loadMoreEndLabel ?? null}
        />
      )}
    </div>
  );
}