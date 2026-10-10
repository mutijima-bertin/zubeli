"use client";
/**
 * Payment step (Phase C-4 — checkout-agent).
 *
 * ---------------------------------------------------------------------------
 * PLUGGABLE PAYMENT SLOT (payment-integration skill)
 * ---------------------------------------------------------------------------
 * The MVP ships three Pay-on-Delivery methods (ADR 0003). When a real
 * gateway lands (MTN MoMo / Airtel Money / cards), the UI swap is confined
 * to this file:
 *   1. add the enum value (MOMO_GATEWAY / CARD) to PAYMENT_OPTIONS below
 *      (backend: register the provider in src/lib/payments/index.ts);
 *   2. if the method needs an extra input beyond the bank reference, extend
 *      the option with a `requiresField` flag + render its input here;
 *   3. nothing else in the checkout flow changes — the form always submits
 *      `{ paymentMethod, bankTransferReference }` to createOrderAction and
 *      the success screen renders `paymentInstructions` from the provider.
 * Never hardcode provider credentials or gateway specifics in the UI —
 * display copy flows from server props / paymentInstructions only.
 *
 * ---------------------------------------------------------------------------
 * CONFIGURABLE SUB-SET (owner launch)
 * ---------------------------------------------------------------------------
 * PAYMENT_OPTIONS is the full catalogue of what this screen CAN offer; the
 * storefront is configured with a subset via the server-side allowlist
 * (`siteConfig.paymentMethods`, parsed from `PAYMENT_METHODS`). The list the
 * customer sees = catalogue ∩ allowlist, in catalogue order (cash first).
 * Only the visible slice changes — never the option wording. The server stays
 * authoritative: it re-rejects any method outside its own allowlist.
 * ---------------------------------------------------------------------------
 */
import { useId } from "react";
import { Card, CardBody, CardHeader, FormField, Input } from "@/components/ui";
import { cx } from "@/components/ui";
import type { PaymentMethod } from "@/types/api";
import type { FieldErrors } from "./fields";

export type PaymentOptionConfig = {
  method: PaymentMethod;
  label: string;
  description: string;
  /** Reveals an extra required input under this option when selected. */
  requiresReference?: boolean;
};

export const PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    method: "COD_CASH",
    label: "Cash on delivery",
    description: "Pay in cash when your order arrives.",
  },
  {
    method: "COD_MOBILE_MONEY",
    label: "Mobile money on delivery",
    description: "Pay via MTN MoMo or Airtel Money when the delivery agent arrives.",
  },
  {
    method: "BANK_TRANSFER",
    label: "Bank transfer",
    description: "Transfer to our account first — the owner confirms manually, usually within one business day.",
    requiresReference: true,
  },
];

export type BankTransferDetailsProps = {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
};

/** Rendered when the allowlist is unusable (missing / empty / unrenderable). */
export const FALLBACK_PAYMENT_METHOD: PaymentMethod = "COD_CASH";

/**
 * The options a customer may actually pick, in catalogue order (COD first).
 *
 * Single source of truth for both the rendered radio group and the parent's
 * selected value (CheckoutFlow) — so the checked radio and the submitted
 * method can never disagree.
 *
 * Defensive: an allowlist that is missing, empty, or names nothing this
 * screen can render degrades to cash on delivery rather than an unusable
 * payment step. Unknown/duplicate entries are simply not renderable here and
 * are dropped; the server owns their validation.
 */
export function visiblePaymentOptions(
  allowedMethods: PaymentMethod[] | null | undefined,
): PaymentOptionConfig[] {
  if (!Array.isArray(allowedMethods) || allowedMethods.length === 0) {
    return PAYMENT_OPTIONS.filter((option) => option.method === FALLBACK_PAYMENT_METHOD);
  }
  const allowed = new Set(allowedMethods);
  const options = PAYMENT_OPTIONS.filter((option) => allowed.has(option.method));
  return options.length > 0
    ? options
    : PAYMENT_OPTIONS.filter((option) => option.method === FALLBACK_PAYMENT_METHOD);
}

export function PaymentMethodPicker({
  value,
  onChange,
  bankTransferReference,
  onReferenceChange,
  errors,
  shopMoMoNumber,
  bankTransferDetails,
  allowedMethods,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  bankTransferReference: string;
  onReferenceChange: (reference: string) => void;
  errors: FieldErrors;
  /** Server props from siteConfig (server-only) — never import siteConfig client-side. */
  shopMoMoNumber: string | null;
  bankTransferDetails: BankTransferDetailsProps | null;
  /** Server prop from siteConfig (server-only) — the configured subset to offer. */
  allowedMethods: PaymentMethod[] | null;
}) {
  const options = visiblePaymentOptions(allowedMethods);
  // Never render a radio group with nothing checked: if `value` is not
  // offered (allowlist narrowed after selection), fall through to the first
  // visible option so the step stays completable.
  const selected =
    options.some((option) => option.method === value) ? value : options[0]?.method ?? value;

  // Stable ids for the selected method's instruction block + the group error,
  // so the radio and the fieldset can be programmatically described (a11y).
  const baseId = useId();
  const instructionId = (method: PaymentMethod) => `${baseId}-instruction-${method}`;
  const paymentMethodErrorId = `${baseId}-error`;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink">Payment method</h2>
      </CardHeader>
      <CardBody>
        <fieldset
          aria-describedby={errors.paymentMethod ? paymentMethodErrorId : undefined}
        >
          <legend className="sr-only">Choose how you&apos;ll pay</legend>

          <div className="space-y-3">
            {options.map((option) => {
              const checked = selected === option.method;
              // Only the SELECTED method exposes its instruction block, so only
              // then does the radio describe it. Combine (not overwrite) so a
              // future static description on the radio is preserved.
              const instruction = checked ? instructionId(option.method) : null;
              const describedBy = [instruction].filter(Boolean).join(" ") || undefined;
              return (
                <div key={option.method}>
                  <label
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      checked
                        ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600"
                        : "border-stone-200 hover:border-stone-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.method}
                      checked={checked}
                      onChange={() => onChange(option.method)}
                      aria-describedby={describedBy}
                      className="mt-0.5 size-4 shrink-0 accent-brand-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-sm text-stone-500">{option.description}</span>
                    </span>
                  </label>

                  {checked && option.method === "COD_MOBILE_MONEY" && (
                    <p id={instructionId("COD_MOBILE_MONEY")} className="mt-2 pl-7 text-xs text-stone-500">
                      {shopMoMoNumber
                        ? `Pay at the door via MTN MoMo or Airtel Money to ${shopMoMoNumber}.`
                        : "Pay at the door via MTN MoMo or Airtel Money when your order arrives."}{" "}
                      Have the confirmation code ready for the delivery agent.
                    </p>
                  )}

                  {checked && option.method === "BANK_TRANSFER" && (
                    <div id={instructionId("BANK_TRANSFER")} className="mt-3 space-y-3 pl-7">
                      {bankTransferDetails ? (
                        <ul className="space-y-0.5 text-xs text-stone-600">
                          {bankTransferDetails.bankName && (
                            <li>
                              <span className="text-stone-500">Bank:</span> {bankTransferDetails.bankName}
                            </li>
                          )}
                          {bankTransferDetails.accountName && (
                            <li>
                              <span className="text-stone-500">Account name:</span>{" "}
                              {bankTransferDetails.accountName}
                            </li>
                          )}
                          {bankTransferDetails.accountNumber && (
                            <li>
                              <span className="text-stone-500">Account number:</span>{" "}
                              {bankTransferDetails.accountNumber}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-stone-500">Ask the shop for current bank transfer details.</p>
                      )}

                      <FormField
                        label="Bank transfer reference"
                        required
                        hint="4–40 letters, digits or dashes — use the same reference on your transfer."
                        error={errors.bankTransferReference}
                      >
                        <Input
                          name="bankTransferReference"
                          autoComplete="off"
                          spellCheck={false}
                          value={bankTransferReference}
                          onChange={(e) => onReferenceChange(e.target.value)}
                          placeholder="e.g. ZBL-20260807"
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {errors.paymentMethod && (
            <p id={paymentMethodErrorId} role="alert" className="mt-2 text-sm text-danger-600">
              {errors.paymentMethod.join(" ")}
            </p>
          )}
        </fieldset>
      </CardBody>
    </Card>
  );
}
