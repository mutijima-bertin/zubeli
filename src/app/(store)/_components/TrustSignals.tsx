import { IconBox, IconCheck, IconMapPin, IconShieldCheck } from "@/components/ui";
import { formatRWF } from "@/lib/format";

/**
 * Trust signals — delivery, Pay on Delivery options and product range.
 * Plain-language copy only: the fee comes from siteConfig (flat per order),
 * payment options mirror the seeded PaymentMethod enum, and the range copy
 * mirrors the storefront Footer. No invented claims (no "free delivery",
 * no warranty specifics — the warranty page does not exist yet).
 */
export function TrustSignals({ deliveryFeeCents }: { deliveryFeeCents: number }) {
  const fee = formatRWF(deliveryFeeCents);
  const signals = [
    {
      icon: IconMapPin,
      title: "Flat delivery fee",
      body: `A flat ${fee} per order — shown at checkout, no surprises.`,
    },
    {
      icon: IconShieldCheck,
      title: "Pay on delivery",
      body: "Cash, MTN MoMo / Airtel Money or bank transfer — pay when your order arrives.",
    },
    {
      icon: IconCheck,
      title: "No payment upfront",
      body: "Place your order online and pay only at the door.",
    },
    {
      icon: IconBox,
      title: "Tools for every job",
      body: "Power tools, hand tools, safety gear and materials — for builders and DIY.",
    },
  ];

  return (
    <section aria-labelledby="trust-heading" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="trust-heading"
          className="text-2xl font-bold tracking-tight text-ink sm:text-3xl"
        >
          Why shop at Zubeli
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {signals.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
              <span
                className="flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-800"
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-stone-600">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
