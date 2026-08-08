import { IconCheck } from "@/components/ui";

/**
 * Compact buy-box trust strip — the PDP is where the store feels serious,
 * so the reassurance lives right under the Add-to-cart button. Plain
 * language, no invented claims: the wording mirrors the homepage
 * TrustSignals ("Pay on delivery", "MTN MoMo / Airtel Money") and the
 * Footer ("Delivery across Rwanda"). Icons are decorative; the text is the
 * content. Static server component — zero client JS.
 */
const points = [
  "Delivery across Rwanda",
  "Pay on delivery — cash or MTN MoMo / Airtel Money",
  "Bank transfer available",
];

export function TrustStrip() {
  return (
    <ul className="mt-4 flex flex-col gap-1.5 border-t border-stone-200 pt-3">
      {points.map((point) => (
        <li key={point} className="flex items-center gap-1.5 text-xs text-stone-600">
          <IconCheck
            className="size-4 shrink-0 text-stone-500"
            aria-hidden="true"
          />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}