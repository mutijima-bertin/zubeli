"use client";
/**
 * Submit button for the checkout form (Phase C-4 — checkout-agent).
 * Presentational: CheckoutFlow owns pending state and the submit handler;
 * this component renders the primary CTA + the pay-on-delivery reassurance.
 * While pending the button shows a spinner and blocks double-submits
 * (server-side idempotency keyed on the cart id is the backstop).
 */
import { Button } from "@/components/ui";

export function PlaceOrderButton({ pending }: { pending: boolean }) {
  return (
    <div>
      <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
        {pending ? "Placing your order…" : "Place order"}
      </Button>
      <p className="mt-2.5 text-center text-xs text-stone-500">
        Nothing is charged now — you pay when your order arrives.
      </p>
    </div>
  );
}
