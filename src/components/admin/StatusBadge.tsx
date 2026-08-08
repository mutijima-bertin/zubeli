import { Badge } from "@/components/ui";
import type { StatusMeta } from "@/lib/format";

export type StatusBadgeProps = {
  /**
   * `{ label, tone }` straight from the shared format maps —
   * `@/lib/format` exports `orderStatusMeta`, `paymentStatusMeta`,
   * `paymentMethodMeta`, `INVENTORY_MOVEMENT_TYPE_META`, `INVENTORY_REASON_META`.
   *
   * @example <StatusBadge meta={orderStatusMeta(order.status)} />
   */
  meta: StatusMeta;
  className?: string;
};

/**
 * Generic admin status chip — a thin, named wrapper over the design-system
 * Badge so screens get one dashboard component for every status rendering.
 * Tones/colors come exclusively from the format maps (never hardcoded).
 */
export function StatusBadge({ meta, className }: StatusBadgeProps) {
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}