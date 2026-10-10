import { Button, IconArrowRight } from "@/components/ui";

/**
 * Closing CTA band — ends the landing page on action (uiux-reviewer landing
 * audit item 9). Ink-dark band, centered: kicker + real h2 + one primary
 * safety-orange CTA (ink-dark text on cta-600 = 5.4:1, never white-on-orange)
 * + one line of trust microcopy. The band is the page's narrative close, so
 * it carries its own brand-400 focus ring like the hero (the global
 * brand-700 ring drops below 3:1 on ink-dark).
 */
export function ClosingCta() {
  return (
    <section aria-labelledby="cta-heading" className="bg-ink-dark py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-cta-600">
          Ready when you are
        </p>
        <h2
          id="cta-heading"
          className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Ready to start your build?
        </h2>
        <p className="mt-4 text-base text-white/80 sm:text-lg">
          Order online and pay when your tools arrive — across Rwanda.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            href="/products"
            size="lg"
            className="focus-visible:outline-brand-400"
          >
            Browse all tools
            <IconArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-6 text-sm text-white/70">
          Pay on delivery — cash, MTN MoMo / Airtel Money or bank transfer.
        </p>
      </div>
    </section>
  );
}