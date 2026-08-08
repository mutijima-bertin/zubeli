import Link from "next/link";
import { IconMail, IconMapPin, IconPhone, IconShieldCheck } from "@/components/ui";

/**
 * Storefront footer — server component. Shop info, Pay-on-Delivery note and
 * link columns. Policy pages don't exist yet, so those entries render as
 * placeholder <span>s instead of dead links (no false affordances).
 */
export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-500 text-sm font-black text-ink-dark">
              Z
            </span>
            Zubeli
          </p>
          <p className="mt-3 max-w-xs text-sm text-stone-600">
            Construction tools and hardware in Rwanda — quality equipment for
            builders, contractors and DIY projects.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Shop</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/products" className="text-stone-700 transition-colors hover:text-brand-700">
                All products
              </Link>
            </li>
            <li>
              <Link href="/" className="text-stone-700 transition-colors hover:text-brand-700">
                Home
              </Link>
            </li>
            <li>
              <Link href="/cart" className="text-stone-700 transition-colors hover:text-brand-700">
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Help</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-700">
            <li>
              <span className="text-stone-500">Shipping &amp; delivery</span>
            </li>
            <li>
              <span className="text-stone-500">Returns &amp; warranty</span>
            </li>
            <li>
              <span className="text-stone-500">Store policies</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Pay on delivery</h2>
          <p className="mt-3 text-sm text-stone-600">
            Pay when your order arrives — cash, mobile money (MTN MoMo / Airtel
            Money), or bank transfer. No payment required upfront.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-stone-700">
            <li className="flex items-center gap-2">
              <IconPhone className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span>+250 700 000 000</span>
            </li>
            <li className="flex items-center gap-2">
              <IconMail className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span>hello@zubeli.rw</span>
            </li>
            <li className="flex items-center gap-2">
              <IconMapPin className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span>Kigali, Rwanda</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-stone-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Zubeli Company Ltd. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <IconShieldCheck className="size-4 text-success-600" aria-hidden="true" />
            Prices in RWF — Pay on delivery across Rwanda
          </p>
        </div>
      </div>
    </footer>
  );
}