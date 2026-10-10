"use client";
/**
 * Checkout flow container (Phase C-4 — checkout-agent). Owns all form state
 * (shipping fields, payment method, bank reference), the client-side mirror
 * of checkoutSchema (plan §R8 — UX-only pre-check; the server stays
 * authoritative), and the createOrderAction submission.
 *
 * Cart state comes from the shared useCart context (same as the cart
 * screen); a mount-time refresh guards against a stale cart (e.g. arriving
 * via the browser Back button after an order was already placed — the cart
 * is emptied server-side inside the createOrder transaction).
 */
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/actions/checkout";
import { Alert, Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";
import type { ActionResult, CheckoutResult, PaymentMethod } from "@/types/api";
import { OrderSummaryPanel } from "./OrderSummaryPanel";
import {
  PaymentMethodPicker,
  visiblePaymentOptions,
  type BankTransferDetailsProps,
} from "./PaymentMethodPicker";
import { PlaceOrderButton } from "./PlaceOrderButton";
import { ShippingForm } from "./ShippingForm";
import {
  getFieldErrors,
  INITIAL_VALUES,
  type FieldErrors,
  type FormValues,
} from "./fields";

// Mirrors BANK_TRANSFER_REFERENCE_RE in src/lib/validation/checkout.ts.
// Intentional duplication (plan §R8): the server is authoritative — this
// pre-check only saves a wasted round-trip.
const BANK_TRANSFER_REFERENCE_RE = /^[A-Z0-9-]{4,40}$/i;
// Permissive pre-check only; zod's email rules run on the server.
const EMAIL_RE = /^\S+@\S+$/;

function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const customer = values.customer;

  const name = customer.name.trim();
  if (name.length < 2) errors["customer.name"] = ["Name is required"];
  else if (name.length > 120) errors["customer.name"] = ["Name must be 120 characters or fewer"];

  const phone = customer.phone.trim();
  if (phone.length < 7) errors["customer.phone"] = ["A valid phone number is required"];
  else if (phone.length > 20) errors["customer.phone"] = ["Phone number must be 20 characters or fewer"];

  const email = customer.email.trim();
  if (email && !EMAIL_RE.test(email)) errors["customer.email"] = ["Enter a valid email address"];

  const address = customer.address.trim();
  if (address.length < 5) errors["customer.address"] = ["Delivery address is required"];
  else if (address.length > 300) errors["customer.address"] = ["Address must be 300 characters or fewer"];

  const city = customer.city.trim();
  if (city && city.length < 2) errors["customer.city"] = ["City is required"];
  else if (city.length > 80) errors["customer.city"] = ["City must be 80 characters or fewer"];

  if (values.paymentMethod === "BANK_TRANSFER") {
    const reference = values.bankTransferReference.trim();
    if (!reference) {
      errors.bankTransferReference = ["Enter the reference you'll use on your transfer"];
    } else if (!BANK_TRANSFER_REFERENCE_RE.test(reference)) {
      errors.bankTransferReference = ["Reference must be 4–40 letters, digits or dashes"];
    }
  }

  return errors;
}

export function CheckoutFlow({
  shopMoMoNumber,
  bankTransferDetails,
  allowedMethods,
}: {
  shopMoMoNumber: string | null;
  bankTransferDetails: BankTransferDetailsProps | null;
  /** Server prop from siteConfig (server-only) — the configured subset to offer. */
  allowedMethods: PaymentMethod[] | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { cart, refresh } = useCart();

  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<ActionResult<CheckoutResult> | null>(null);
  const [isPending, startTransition] = useTransition();

  // Authoritative cart on mount — catches stale context after an order was
  // already placed for this cart (server empties it in the order transaction).
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, []);

  const serverErrors = useMemo(
    () => (result && !result.ok ? getFieldErrors(result.error.details) : {}),
    [result],
  );

  /*
   * The configured subset the customer may pick (server allowlist ∩ this
   * screen's catalogue). Derived, not stored: narrowing the allowlist can
   * never leave the form holding a method the radio group no longer offers.
   */
  const visibleOptions = useMemo(() => visiblePaymentOptions(allowedMethods), [allowedMethods]);

  /**
   * The method the form actually uses. When the current selection is not
   * offered (allowlist narrowed, e.g. owner launched cash-only) the first
   * visible option is selected instead — otherwise the radio group would
   * show nothing checked AND we would submit a method the server rejects.
   */
  const paymentMethod = useMemo<PaymentMethod>(
    () =>
      visibleOptions.some((option) => option.method === values.paymentMethod)
        ? values.paymentMethod
        : (visibleOptions[0]?.method ?? values.paymentMethod),
    [visibleOptions, values.paymentMethod],
  );

  const fieldErrors: FieldErrors = useMemo(() => {
    const merged = { ...clientErrors, ...serverErrors };
    // The reference only exists while BANK_TRANSFER is selected — switching
    // methods clears the input value (handlePaymentMethodChange) and any
    // error that belonged to it (plan C-4).
    if (paymentMethod !== "BANK_TRANSFER") delete merged.bankTransferReference;
    return merged;
  }, [clientErrors, serverErrors, paymentMethod]);

  // VALIDATION errors normally render per-field; a VALIDATION error without
  // fieldErrors (e.g. "Your cart is empty", unavailable product) or any
  // other code (OUT_OF_STOCK, RATE_LIMITED, INTERNAL) is page-level.
  const pageError =
    result && !result.ok && (result.error.code !== "VALIDATION" || Object.keys(serverErrors).length === 0)
      ? result.error
      : null;

  function handleCustomerChange(patch: Partial<FormValues["customer"]>) {
    setValues((v) => ({ ...v, customer: { ...v.customer, ...patch } }));
  }

  function handlePaymentMethodChange(method: PaymentMethod) {
    setValues((v) => ({
      ...v,
      paymentMethod: method,
      // Switching methods clears the reference (plan C-4) — the server
      // rejects a reference on non-BANK_TRANSFER methods.
      bankTransferReference: method === "BANK_TRANSFER" ? v.bankTransferReference : "",
    }));
    setClientErrors((prev) => {
      if (!prev.bankTransferReference) return prev;
      const rest = { ...prev };
      delete rest.bankTransferReference;
      return rest;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Validate and submit the EFFECTIVE method (the one actually offered and
    // checked in the radio group), never a stale selection the configured
    // allowlist no longer offers.
    const submitted: FormValues = { ...values, paymentMethod };

    const errors = validateForm(submitted);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setResult(null);
    startTransition(async () => {
      const res = await createOrderAction({
        customer: submitted.customer,
        paymentMethod: submitted.paymentMethod,
        bankTransferReference:
          submitted.paymentMethod === "BANK_TRANSFER" ? submitted.bankTransferReference : undefined,
      });

      if (res.ok) {
        toast({
          tone: "success",
          title: "Order placed",
          message: `Order ${res.data.order.number} — thank you!`,
        });
        // The server cleared the cart in the order transaction — refresh the
        // shared context so the header badge empties on the success page.
        void refresh();
        // Hard refresh safe: the success page re-fetches via
        // getCheckoutOrderAction (public, Decision A).
        router.replace(`/checkout/success?order=${res.data.order.id}`);
      } else {
        setResult(res);
      }
    });
  }

  // Provider still hydrating (guest first visit / refresh in flight).
  // Skeletons mirror the real DOM order below: summary card first (top on
  // mobile; right-hand rail on lg+), then the form blocks.
  if (!cart) {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-hidden="true">
        <div className="min-w-0 lg:order-last">
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  // Empty cart → no dead form (plan C-4).
  if (cart.items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Your cart is empty"
          description="Add some tools to your cart before checking out."
          action={
            <Button href="/products" size="lg">
              Browse tools
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/*
       * Mobile-first order (audit #12): the summary comes FIRST in the DOM so
       * on <lg screens it appears above the form and the reading/focus order
       * matches the visual order. On lg+ the aside drops back to the right
       * rail (lg:order-last) and the form takes the left column — desktop
       * layout is unchanged. One summary instance only — no duplication.
       */}
      <aside className="min-w-0 lg:order-last">
        <div className="space-y-4 lg:sticky lg:top-6">
          <OrderSummaryPanel />
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {pageError && (
          <Alert tone="danger" title="We couldn't place your order">
            {pageError.message}
          </Alert>
        )}

        <ShippingForm
          values={values.customer}
          onChange={handleCustomerChange}
          errors={fieldErrors}
        />

        <PaymentMethodPicker
          value={paymentMethod}
          onChange={handlePaymentMethodChange}
          bankTransferReference={values.bankTransferReference}
          onReferenceChange={(reference) =>
            setValues((v) => ({ ...v, bankTransferReference: reference }))
          }
          errors={fieldErrors}
          shopMoMoNumber={shopMoMoNumber}
          bankTransferDetails={bankTransferDetails}
          allowedMethods={allowedMethods}
        />

        <PlaceOrderButton pending={isPending} />
      </div>
    </form>
  );
}
