import Image from "next/image";
import Link from "next/link";
import { Button, IconArrowRight } from "@/components/ui";

/**
 * Home hero — value prop + two CTAs. Server component, no state.
 * Dark ink background (construction-site steel) with the safety-orange
 * `cta` accent on the primary action.
 *
 * Visual zone (sm+): a Swiss-grid product collage built from REAL product
 * photos (`/images/products/stock/*.jpg`, the same files the storefront
 * renders). Decorative — `aria-hidden` + `alt=""`; the h1 stays the
 * screen-reader anchor. The two top-row images carry `priority` (they are
 * the LCP), the bottom row loads lazy. Collage is hidden below `sm` so the
 * value prop and CTAs keep priority on small phones. Tiles are static (no
 * idle animation; global reduced-motion kill in globals.css).
 *
 * Focus ring: the global ring is brand-700 (5.02:1 on light) — on the dark
 * hero it drops below 3:1, so hero links scope their own brand-400 ring
 * (~11:1 on ink-dark).
 */
export function Hero() {
  const collageTiles = [
    {
      src: "/images/products/stock/power-drill.jpg",
      priority: true,
      className: "-rotate-2", // top row
    },
    {
      src: "/images/products/stock/angle-grinder.jpg",
      priority: true,
      className: "mt-10 rotate-2", // top row
    },
    {
      src: "/images/products/stock/chainsaw.jpg",
      priority: false,
      className: "-rotate-1", // bottom row
    },
    {
      src: "/images/products/stock/cement-50kg.jpg",
      priority: false,
      className: "mt-10 rotate-1", // bottom row
    },
  ] as const;

  return (
    <section className="bg-gradient-to-b from-ink to-ink-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-400">
            <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" />
            Construction tools &amp; hardware — Kigali, Rwanda
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Construction tools in Rwanda, delivered where you work.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg lg:text-xl">
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
          {/* Payment trust chips — mirror the checkout copy (no new data). */}
          <ul className="mt-6 flex flex-wrap gap-2">
            {[
              "Pay on delivery",
              "MTN MoMo / Airtel Money",
              "Bank transfer",
            ].map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>

        {/* Product collage — decorative (aria-hidden), sm and up.
            `isolate` creates the stacking context so the -z-10 orange glow
            paints BEHIND the tiles but above the section background. */}
        <div className="relative isolate mt-14 hidden sm:block" aria-hidden="true">
          {/* Soft safety-orange glow behind the tiles */}
          <span className="absolute -inset-10 -z-10 rounded-full bg-cta-600/15 blur-3xl" />
          <div className="grid grid-cols-2 gap-4">
            {collageTiles.map((tile) => (
              <div
                key={tile.src}
                className={`relative aspect-[4/3] overflow-hidden rounded-3xl shadow-pop ${tile.className}`}
              >
                <Image
                  src={tile.src}
                  alt=""
                  fill
                  priority={tile.priority}
                  loading={tile.priority ? undefined : "lazy"}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}