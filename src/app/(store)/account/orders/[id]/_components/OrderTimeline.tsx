import { IconCheck } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { OrderDTO } from "@/types/api";

type StepState = "done" | "current" | "upcoming" | "terminal";

type Step = {
  label: string;
  date: string | null;
  state: StepState;
};

/**
 * Derives the status timeline from the order lifecycle (ADR 0001/0003):
 * PENDING → PAID → FULFILLED, with CANCELLED and REFUNDED as termini.
 * Timestamps come from OrderDTO (createdAt/paidAt/fulfilledAt/cancelledAt);
 * the REFUNDED terminus has no DTO timestamp and renders without a date.
 */
export function buildOrderTimeline(order: OrderDTO): Step[] {
  if (order.status === "CANCELLED") {
    return [
      { label: "Order placed", date: order.createdAt, state: "done" },
      { label: "Order cancelled", date: order.cancelledAt, state: "current" },
    ];
  }

  if (order.status === "REFUNDED") {
    return [
      { label: "Order placed", date: order.createdAt, state: "done" },
      { label: "Payment received", date: order.paidAt, state: "done" },
      ...(order.fulfilledAt
        ? [{ label: "Order fulfilled", date: order.fulfilledAt, state: "done" as const }]
        : []),
      { label: "Refunded", date: null, state: "terminal" },
    ];
  }

  // PENDING / PAID / FULFILLED
  const paymentState: StepState =
    order.status === "PENDING" ? "current" : "done";
  const fulfillmentState: StepState =
    order.status === "FULFILLED" ? "done" : order.status === "PAID" ? "current" : "upcoming";

  return [
    { label: "Order placed", date: order.createdAt, state: "done" },
    {
      label: "Payment received",
      date: order.status === "PENDING" ? null : order.paidAt,
      state: paymentState,
    },
    {
      label: "Order fulfilled",
      date: order.status === "FULFILLED" ? order.fulfilledAt : null,
      state: fulfillmentState,
    },
  ];
}

function stepCaption(state: StepState): string {
  switch (state) {
    case "current":
      return "In progress";
    case "upcoming":
      return "Upcoming";
    case "terminal":
      return "—";
    case "done":
      return "—";
  }
}

const dotStyles: Record<StepState, string> = {
  done: "bg-success-600 text-white",
  current: "bg-brand-700 text-white ring-4 ring-brand-100",
  upcoming: "bg-stone-200 text-stone-400",
  terminal: "bg-stone-500 text-white",
};

/**
 * Status timeline (Phase C-5 — account-agent). Server-rendered ordered list;
 * state is conveyed by text (done/current/upcoming captions + dates), not
 * color alone — the dots are decorative (aria-hidden).
 */
export function OrderTimeline({ order }: { order: OrderDTO }) {
  const steps = buildOrderTimeline(order);

  return (
    <ol className="mt-1">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex gap-3 pb-7 last:pb-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[13px] top-7 w-px bg-stone-200"
            />
          )}
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${dotStyles[step.state]}`}
          >
            {step.state === "done" && <IconCheck className="size-3.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-ink">{step.label}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              {step.date ? formatDateTime(step.date) : stepCaption(step.state)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
