import { Price } from "@/components/ui";

/**
 * Buy-box price: large formatted amount (integer RWF cents, always via the
 * shared Price component — never hand-formatted) + unit caption.
 */
export function PriceBlock({
  priceCents,
  currency,
}: {
  priceCents: number;
  currency: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <Price cents={priceCents} currency={currency} size="xl" />
      <span className="text-sm text-stone-500">per item</span>
    </div>
  );
}
