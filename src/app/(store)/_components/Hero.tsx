import Image from "next/image";
import Link from "next/link";
import { Button, IconArrowRight } from "@/components/ui";

/**
 * Home hero — value prop + two CTAs. Server component, no state.
 * Dark ink background (construction-site steel) with the safety-orange
 * `cta` accent on the primary action.
 *
 * Visual zone (lg+ only): a Swiss-grid product collage built from the seeded
 * branded SVGs (`/images/products/*.svg`, same local files the storefront
 * renders). Decorative — `aria-hidden` + `alt=""`; the h1 stays the
 * screen-reader anchor. Collage is hidden below `lg` so the value prop and
 * CTAs keep priority on small screens. Tiles are static (no idle animation;
 * global reduced-motion kill in globals.css).
 *
 * Focus ring: the global ring is brand-700 (5.02:1 on light) — on the dark
 * hero it drops below 3:1, so hero links scope their own brand-400 ring
 * (~11:1 on ink-dark).
 */
export function Hero() {
  return (
    <section className="bg-gradient-to-b from-ink to-ink-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-400">
            <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" />
            Construction tools &amp; hardware — Kigali, Rwanda
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Construction tools in Rwanda, delivered where you work.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            Power tools, hand tools, safety gear and materials for builders and
            DIY projects. Order online and pay on delivery — cash, mobile money
            or bank transfer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              href="/products"
              size="lg"
              className="focus-visible:outline-brand-400"
            >
              Browse all tools
              <IconArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Link
              href="#categories"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-brand-400"
            >
              Shop by category
            </Link>
          </div>
        </div>

        {/* Product collage — decorative (aria-hidden), desktop only. */}
        <div className="relative mt-14 hidden lg:block" aria-hidden="true">
          {/* Soft safety-orange glow behind the tiles */}
          <span className="absolute -inset-10 -z-10 rounded-full bg-cta-600/15 blur-3xl" />
          <div className="grid grid-cols-2 gap-4">
            <Image
              src="/images/products/power-drill.svg"
              alt=""
              width={800}
              height={800}
              className="-rotate-2 rounded-3xl shadow-pop"
            />
            <Image
              src="/images/products/circular-saw.svg"
              alt=""
              width={800}
              height={800}
              className="mt-10 rotate-2 rounded-3xl shadow-pop"
            />
            <Image
              src="/images/products/safety-helmet.svg"
              alt=""
              width={800}
              height={800}
              className="-rotate-1 rounded-3xl shadow-pop"
            />
            <Image
              src="/images/products/wheelbarrow.svg"
              alt=""
              width={800}
              height={800}
              className="mt-10 rotate-1 rounded-3xl shadow-pop"
            />
          </div>
        </div>
      </div>
    </section>
  );
}