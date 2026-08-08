import type { PaymentMethod } from "@/types/api";

/**
 * Shared field-state types for the checkout flow (checkout-agent).
 * Mirrors the checkoutSchema payload shape (src/lib/validation/checkout.ts) —
 * the server stays authoritative; these types exist so ShippingForm,
 * PaymentMethodPicker and CheckoutFlow agree on one shape.
 */

export type CustomerValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
};

export type FormValues = {
  customer: CustomerValues;
  paymentMethod: PaymentMethod;
  bankTransferReference: string;
};

export const INITIAL_VALUES: FormValues = {
  customer: { name: "", phone: "", email: "", address: "", city: "" },
  paymentMethod: "COD_CASH",
  bankTransferReference: "",
};

/**
 * ZodError fieldErrors shape (src/lib/errors.ts toActionResult): dotted keys
 * for nested schemas ("customer.name") → string arrays.
 */
export type FieldErrors = Record<string, string[] | undefined>;

export function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}
