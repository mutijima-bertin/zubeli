import { cx } from "./utils";

/**
 * Table primitives (Container/Head/Body/Row/Cell/HeaderCell).
 * Zebra rows + sticky header-ready; use `Table.HeaderCell` for `<th scope>`.
 *
 * @example
 * <Table.Container>
 *   <Table.Head>
 *     <Table.Row>
 *       <Table.HeaderCell>Order</Table.HeaderCell>
 *     </Table.Row>
 *   </Table.Head>
 *   <Table.Body>
 *     <Table.Row>
 *       <Table.Cell className="text-right">12,500 RWF</Table.Cell>
 *     </Table.Row>
 *   </Table.Body>
 * </Table.Container>
 */
export function TableContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("overflow-x-auto rounded-xl border border-stone-200", className)}>
      <table className="min-w-full divide-y divide-stone-200 text-left">{children}</table>
    </div>
  );
}

export function TableHead({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <thead className={cx("bg-stone-50", className)}>{children}</thead>;
}

export function TableBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <tbody className={cx("divide-y divide-stone-100 bg-white", className)}>{children}</tbody>;
}

export function TableRow({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cx("transition-colors hover:bg-stone-50", className)} {...rest}>
      {children}
    </tr>
  );
}

export function HeaderCell({
  className,
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-4 py-3 text-sm text-stone-700", className)} {...rest}>
      {children}
    </td>
  );
}

export const Table = {
  Container: TableContainer,
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeaderCell,
};