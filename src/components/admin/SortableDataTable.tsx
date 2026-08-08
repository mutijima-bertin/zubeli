"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import type { DataTableProps } from "./DataTable";
import { IconChevronDown, IconChevronUp, IconSort } from "./icons";

/**
 * Client-side sortable twin of {@link DataTable}. `DataTable` delegates here
 * automatically when ANY column opts in via `sortable: true` — screens never
 * import this widget directly.
 *
 * Rules:
 * - Sorting is purely client state (no server action / URL changes).
 * - First click on a column sorts ascending; same-column clicks toggle
 *   asc/desc; switching columns starts fresh at ascending.
 * - The th carries `aria-sort` and the header is a real <button> (keyboard
 *   focusable, global focus ring applies).
 * - Sorting is stable: equal values keep their original relative order, so
 *   screens that pass a pre-sorted array (e.g. server order by date) degrade
 *   gracefully until the user sorts explicitly.
 *
 * NOTE for adopters: because this widget is a client component, the
 * consuming screen must itself be a client component ("use client") when
 * `sortable` is set — render functions cross no server boundary then.
 */
export function SortableDataTable<T>({
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
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const showPager = typeof hasMore === "boolean" && Boolean(onLoadMore);
  const bodyColSpan = columns.length;

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const getValue =
      col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[sort.key]);
    return data
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const diff = compareSortValues(getValue(a.row), getValue(b.row));
        if (diff === 0) return a.index - b.index; // keep original order on ties
        return sort.dir === "asc" ? diff : -diff;
      })
      .map((entry) => entry.row);
  }, [data, sort, columns]);

  function defaultCell(row: T, key: string): ReactNode {
    const raw = (row as Record<string, unknown>)[key];
    return raw == null ? "—" : String(raw);
  }

  const table = (
    <Table.Container className={cx("bg-white", className)}>
      <Table.Head>
        <Table.Row>
          {columns.map((col) => {
            const active = sort?.key === col.key;
            return (
              <Table.HeaderCell
                key={col.key}
                className={col.className}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cx(
                      "group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
                      active ? "text-ink" : "text-stone-500 hover:bg-stone-200/60 hover:text-ink",
                    )}
                  >
                    {col.header}
                    {active ? (
                      sort.dir === "asc" ? (
                        <IconChevronUp className="size-3.5 shrink-0 text-ink" />
                      ) : (
                        <IconChevronDown className="size-3.5 shrink-0 text-ink" />
                      )
                    ) : (
                      <IconSort className="size-3.5 shrink-0 text-stone-300 group-hover:text-stone-500" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </Table.HeaderCell>
            );
          })}
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
          sortedData.map((row) => {
            const href = rowLink?.(row) ?? null;
            return (
              <Table.Row key={rowKey(row)} className={href ? "relative cursor-pointer" : undefined}>
                {columns.map((col, index) => {
                  const content = col.render ? col.render(row) : defaultCell(row, col.key);
                  if (index === 0 && href) {
                    return (
                      <Table.Cell key={col.key} className={col.className}>
                        <Link href={href} className="after:absolute after:inset-0">
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

/** Numeric compares numerically, everything else as text (natural order). */
function compareSortValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}