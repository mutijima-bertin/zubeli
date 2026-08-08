import { IconMapPin } from "@/components/ui";
import { formatRWF } from "@/lib/format";

/**
 * Home delivery banner — the flat delivery fee from siteConfig, surfaced
 * on the landing page so customers know the cost before checkout.
 * Static informational band; no live region (it does not change).
 */
export function DeliveryBanner({ deliveryFeeCents }: { deliveryFeeCents: number }) {
  return (
    <div className="border-y border-brand-100 bg-brand-50">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6 lg:px-8">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800"
          aria-hidden="true"
        >
          <IconMapPin className="size-5" />
        </span>
        <p className="text-sm text-ink sm:text-base">
          Flat delivery fee of{" "}
          <strong className="font-semibold">{formatRWF(deliveryFeeCents)}</strong>{" "}
          per order — shown at checkout, no hidden costs.
        </p>
      </div>
    </div>
  );
}
