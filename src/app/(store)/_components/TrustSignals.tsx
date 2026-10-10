import { IconBox, IconMapPin, IconShieldCheck } from "@/components/ui";

/**
 * Trust signals — delivery reach, range breadth and Pay on Delivery.
 * Deliberately trimmed to THREE cards (uiux-reviewer landing audit item 6):
 * the old grid had 3-of-4 cards telling the payment story. Payment options
 * here mirror the seeded PaymentMethod enum once only.
 * Plain-language copy only: no invented claims (no "free delivery", no
 * warranty specifics — the warranty page does not exist yet).
 */
export function TrustSignals() {
  const signals = [
    {
      icon: IconMapPin,
      title: "Delivery across Rwanda",
      body: "Order online and we deliver your tools to you — across Rwanda.",
    },
    {
      icon: IconBox,
      title: "Tools for every job",
      body: "Power tools, hand tools, safety gear and materials — for builders and DIY.",
    },
    {
      icon: IconShieldCheck,
      title: "Pay on delivery",
      body: "Cash, MTN MoMo / Airtel Money or bank transfer — pay when your order arrives.",
    },
  ];

  return (
    <section aria-labelledby="trust-heading" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-cta-600">
          Why Zubeli
        </p>
        <h2
          id="trust-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
        >
          Why shop at Zubeli
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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