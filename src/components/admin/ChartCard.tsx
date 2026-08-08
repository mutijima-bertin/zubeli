import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { cx } from "@/components/ui";

export type ChartCardProps = {
  title: string;
  description?: string;
  /**
   * The chart body — screens provide their own markup (simple bars or tables
   * built with divs/wrappers; NO chart library in the MVP).
   */
  children: ReactNode;
  /** Extra classes on the outer card (e.g. `sm:col-span-2` for grids). */
  className?: string;
  /** Min-height so Skeleton states and empty bodies do not collapse. */
  bodyMinHeightClassName?: string;
};

/**
 * Titled panel for any dashboard chart/table block. Pure presentational —
 * the screen owns the data fetch, the loading/empty states and the chart
 * markup; this component guarantees consistent Card sizing + heading.
 */
export function ChartCard({
  title,
  description,
  children,
  className,
  bodyMinHeightClassName = "min-h-40",
}: ChartCardProps) {
  return (
    <Card className={cx("flex flex-col", className)}>
      <CardHeader title={title} description={description} />
      <CardBody className={cx("flex-1", bodyMinHeightClassName)}>
        {children}
      </CardBody>
    </Card>
  );
}