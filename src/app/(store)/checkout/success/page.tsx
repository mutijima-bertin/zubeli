import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCheckoutOrderAction } from "@/actions/checkout";
import { getSession } from "@/lib/auth/session";
import { Alert, Button } from "@/components/ui";
import { SuccessScreen } from "../_components/SuccessScreen";

export const metadata: Metadata = {
  title: "Order confirmed | Zubeli",
  description: "Your Zubeli order was placed — here's how to pay.",
};

/**
 * Order-confirmation screen (Phase C-4 — checkout-agent). Guarded: a
 * missing/empty `?order=` param (direct visit) redirects home. The order is
 * then re-fetched via the PUBLIC getCheckoutOrderAction (Decision A) — no
 * auth, high-entropy order id — so a hard refresh always renders the same
 * confirmation. Unknown ids redirect home; only genuine failures (rate
 * limit, internal) render an error state.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order: orderParam } = await searchParams;
  const orderId = Array.isArray(orderParam) ? orderParam[0] : orderParam;
  if (!orderId || orderId.trim() === "") redirect("/");

  const session = await getSession();
  const result = await getCheckoutOrderAction({ orderId: orderId.trim() });

  if (!result.ok) {
    // Garbage / unknown order id — nothing to show; home is friendlier than a 404.
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION") {
      redirect("/");
    }
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Alert tone="danger" title="We couldn't load this order">
          {result.error.message}
        </Alert>
        <Button href="/" className="mt-4">
          Back to home
        </Button>
      </div>
    );
  }

  return (
    <SuccessScreen
      order={result.data.order}
      paymentInstructions={result.data.paymentInstructions}
      isSignedIn={Boolean(session)}
    />
  );
}
