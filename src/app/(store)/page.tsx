import type { Metadata } from "next";
import { getHomepageData } from "@/lib/storefront";
import { CategoriesShowcase } from "./_components/CategoriesShowcase";
import { DeliveryBanner } from "./_components/DeliveryBanner";
import { FeaturedProducts } from "./_components/FeaturedProducts";
import { Hero } from "./_components/Hero";
import { TrustSignals } from "./_components/TrustSignals";

export const metadata: Metadata = {
  title: "Construction Tools in Rwanda | Zubeli",
  description:
    "Browse power tools, hand tools, safety gear and construction materials in Rwanda. Order online at Zubeli and pay on delivery — cash, mobile money or bank transfer.",
};

/**
 * Home / landing page (Phase B — homepage-agent).
 * Server component: one data pass via getHomepageData() (server-only helper,
 * per build plan §0), serializable props into plain server sections.
 * No client state at this level.
 */
export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <>
      <Hero />
      <DeliveryBanner deliveryFeeCents={data.deliveryFeeCents} />
      <FeaturedProducts products={data.featured} />
      <CategoriesShowcase categories={data.categories} />
      <TrustSignals deliveryFeeCents={data.deliveryFeeCents} />
    </>
  );
}
