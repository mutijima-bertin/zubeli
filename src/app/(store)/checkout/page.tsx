import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { CheckoutFlow } from "./_components/CheckoutFlow";

export const metadata: Metadata = {
  title: "Checkout | Zubeli",
  description:
    "Secure your construction tools — pay on delivery in Rwanda: cash, mobile money or bank transfer.",
};

/**
 * Checkout screen (Phase C-4 — checkout-agent). Server shell: cart state
 * lives in the shared CartProvider (mirrors the cart screen pattern), so
 * only server-only siteConfig values (MoMo number + bank details + the
 * configured payment-method allowlist) are read here and passed down as
 * serializable props — the server-only module never reaches the client bundle
 * (plan risk #6). All form logic, validation mirroring and the
 * createOrderAction submission live in CheckoutFlow.
 */
export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Checkout</h1>
      <p className="mt-1 text-sm text-stone-600 sm:text-base">
        Tell us where to deliver and how you&apos;ll pay. Nothing is charged today.
      </p>

      <CheckoutFlow
        shopMoMoNumber={siteConfig.shopMoMoNumber}
        bankTransferDetails={siteConfig.bankTransferDetails}
        allowedMethods={siteConfig.paymentMethods}
      />
    </div>
  );
}
