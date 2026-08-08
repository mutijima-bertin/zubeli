'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelOrderAction,
  confirmOrderPaymentAction,
  fulfillOrderAction,
  refundOrderAction,
} from '@/actions/admin/orders';
import { Alert, Button, Card, CardBody, CardHeader, Dialog } from '@/components/ui';
import type { ActionResult, OrderDTO, OrderStatus } from '@/types/api';

type OrderActionKey = 'confirm' | 'fulfill' | 'cancel' | 'refund';

const ACTION_META: Record<
  OrderActionKey,
  { label: string; verb: string; description: string; variant: 'primary' | 'secondary' | 'danger' | 'outline' }
> = {
  confirm: {
    label: 'Confirm payment',
    verb: 'confirm the payment',
    variant: 'primary',
    description:
      'Mark the order as paid. The bank transfer reference was captured at checkout — nothing more is needed.',
  },
  fulfill: {
    label: 'Fulfill',
    verb: 'fulfil the order',
    variant: 'secondary',
    description: 'Mark the order as fulfilled (delivered to the customer).',
  },
  cancel: {
    label: 'Cancel',
    verb: 'cancel the order',
    variant: 'danger',
    description: 'Cancel the order and return its items to stock. This cannot be undone.',
  },
  refund: {
    label: 'Refund',
    verb: 'refund the order',
    variant: 'outline',
    description: 'Refund the order and return its items to stock. This cannot be undone.',
  },
};

const ACTION_ORDER: OrderActionKey[] = ['confirm', 'fulfill', 'cancel', 'refund'];

function isActionAvailable(key: OrderActionKey, status: OrderStatus): boolean {
  switch (key) {
    case 'confirm':
      return status === 'PENDING';
    case 'fulfill':
      return status === 'PAID';
    case 'cancel':
      return status === 'PENDING' || status === 'PAID';
    case 'refund':
      return status === 'PAID' || status === 'FULFILLED';
  }
}

type Feedback = { tone: 'success' | 'danger'; title: string; message: string };

/**
 * Order status actions (client island on the admin detail page). Buttons are
 * derived from the current OrderStatus — only valid lifecycle transitions are
 * ever enabled (server enforces the same rule via lib/orders-admin). Every
 * action goes through a confirm Dialog, calls the server action, then
 * router.refresh() so the server re-renders the new state.
 */
export function StatusActions({
  orderId,
  status,
  orderNumber,
}: {
  orderId: string;
  status: OrderStatus;
  orderNumber: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<OrderActionKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const dialogMeta = pendingAction ? ACTION_META[pendingAction] : null;

  const ACTION_FN: Record<OrderActionKey, (input: { orderId: string }) => Promise<ActionResult<OrderDTO>>> = {
    confirm: confirmOrderPaymentAction,
    fulfill: fulfillOrderAction,
    cancel: cancelOrderAction,
    refund: refundOrderAction,
  };

  async function perform(key: OrderActionKey) {
    const result = await ACTION_FN[key]({ orderId });

    if (result.ok) {
      setPendingAction(null);
      setFeedback({
        tone: 'success',
        title: 'Order updated',
        message: `${ACTION_META[key].label} for ${orderNumber} succeeded.`,
      });
      router.refresh();
    } else {
      setPendingAction(null);
      setFeedback({
        tone: 'danger',
        title: `Couldn't ${ACTION_META[key].verb}`,
        message: result.error.message,
      });
    }
  }

  function onDialogConfirm() {
    if (!pendingAction) return;
    const key = pendingAction;
    startTransition(() => {
      void perform(key);
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink">Order actions</h2>
      </CardHeader>
      <CardBody>
        <div className="flex flex-wrap items-center gap-2">
          {ACTION_ORDER.map((key) => {
            const enabled = isActionAvailable(key, status);
            const meta = ACTION_META[key];
            return (
              <span
                key={key}
                title={enabled ? undefined : `Unavailable while the order is ${status.toLowerCase()}`}
              >
                <Button
                  variant={meta.variant}
                  size="md"
                  disabled={!enabled || isPending}
                  onClick={() => setPendingAction(key)}
                >
                  {meta.label}
                </Button>
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-stone-500">
          Only valid transitions are available for the current order status.
        </p>

        {feedback && (
          <div className="mt-4">
            <Alert tone={feedback.tone} title={feedback.title}>
              {feedback.message}
            </Alert>
          </div>
        )}
      </CardBody>

      <Dialog
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!isPending) setPendingAction(null);
        }}
        title={dialogMeta ? `${dialogMeta.label} ${orderNumber}?` : undefined}
        label="Confirm order action"
      >
        <div className="px-5 py-4">
          {dialogMeta && (
            <>
              <p className="text-sm text-stone-600">{dialogMeta.description}</p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPendingAction(null)}
                  disabled={isPending}
                >
                  Keep order
                </Button>
                <Button
                  variant={dialogMeta.variant}
                  loading={isPending}
                  disabled={isPending}
                  onClick={onDialogConfirm}
                >
                  {dialogMeta.label}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </Card>
  );
}