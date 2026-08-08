"use client";
/**
 * Delivery details form (Phase C-4 — checkout-agent). Controlled inputs —
 * CheckoutFlow owns the values; this component only renders fields + errors.
 * Field names mirror checkoutSchema (customer.name/phone/email/address/city);
 * server field errors arrive with dotted keys ("customer.name") and render
 * under the matching input via FormField.
 */
import { Card, CardBody, CardHeader, FormField, Input } from "@/components/ui";
import type { CustomerValues, FieldErrors } from "./fields";

export function ShippingForm({
  values,
  onChange,
  errors,
}: {
  values: CustomerValues;
  onChange: (patch: Partial<CustomerValues>) => void;
  errors: FieldErrors;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink">Delivery details</h2>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <FormField label="Full name" required error={errors["customer.name"]}>
            <Input
              name="customer.name"
              autoComplete="name"
              value={values.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Your name"
            />
          </FormField>

          <FormField label="Phone number" required error={errors["customer.phone"]}>
            <Input
              name="customer.phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="07XX XXX XXX"
            />
          </FormField>

          <FormField
            label="Email (optional)"
            hint="Only used for order updates — we never send spam."
            error={errors["customer.email"]}
          >
            <Input
              name="customer.email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@example.com"
            />
          </FormField>

          <FormField
            label="Delivery address"
            required
            hint="Where should we deliver your tools?"
            error={errors["customer.address"]}
          >
            <Input
              name="customer.address"
              autoComplete="street-address"
              value={values.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder="Street, house or site description"
            />
          </FormField>

          <FormField label="City (optional)" error={errors["customer.city"]}>
            <Input
              name="customer.city"
              autoComplete="address-level2"
              value={values.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="Kigali"
            />
          </FormField>
        </div>
      </CardBody>
    </Card>
  );
}
