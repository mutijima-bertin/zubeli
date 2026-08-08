/**
 * Payment instructions card (Phase C-4 — checkout-agent). Renders the
 * provider-built PaymentInstructions (title + ordered steps) that
 * createOrderAction / getCheckoutOrderAction return — e.g. the bank transfer
 * reference for BANK_TRANSFER or the MoMo pay-at-door steps. Used on the
 * order-confirmation screen; the same data also renders in account order
 * details (account-agent renders its own copy inline).
 */
import { Card, CardBody, CardHeader } from "@/components/ui";
import type { PaymentInstructions } from "@/types/api";

export function PaymentInstructionsPanel({
  instructions,
}: {
  instructions: PaymentInstructions;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink">How to pay</h2>
      </CardHeader>
      <CardBody>
        <h3 className="text-sm font-semibold text-ink">{instructions.title}</h3>
        {instructions.steps.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">
            Payment instructions will follow — our team will reach out to confirm.
          </p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-600">
            {instructions.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
