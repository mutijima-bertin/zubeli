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
 * ---------------------------------------------------------------------------
 */
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

export function PaymentMethodPicker({
  value,
  onChange,
  bankTransferReference,
  onReferenceChange,
  errors,
  shopMoMoNumber,
  bankTransferDetails,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  bankTransferReference: string;
  onReferenceChange: (reference: string) => void;
  errors: FieldErrors;
  /** Server props from siteConfig (server-only) — never import siteConfig client-side. */
  shopMoMoNumber: string | null;
  bankTransferDetails: BankTransferDetailsProps | null;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink">Payment method</h2>
      </CardHeader>
      <CardBody>
        <fieldset>
          <legend className="sr-only">Choose how you&apos;ll pay</legend>

          <div className="space-y-3">
            {PAYMENT_OPTIONS.map((option) => {
              const checked = value === option.method;
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
                      className="mt-0.5 size-4 shrink-0 accent-brand-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-sm text-stone-500">{option.description}</span>
                    </span>
                  </label>

                  {checked && option.method === "COD_MOBILE_MONEY" && (
                    <p className="mt-2 pl-7 text-xs text-stone-500">
                      {shopMoMoNumber
                        ? `Pay at the door via MTN MoMo or Airtel Money to ${shopMoMoNumber}.`
                        : "Pay at the door via MTN MoMo or Airtel Money when your order arrives."}{" "}
                      Have the confirmation code ready for the delivery agent.
                    </p>
                  )}

                  {checked && option.method === "BANK_TRANSFER" && (
                    <div className="mt-3 space-y-3 pl-7">
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
            <p role="alert" className="mt-2 text-sm text-danger-600">
              {errors.paymentMethod.join(" ")}
            </p>
          )}
        </fieldset>
      </CardBody>
    </Card>
  );
}
