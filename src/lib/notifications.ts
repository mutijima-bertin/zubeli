/**
 * In-app notification helpers — the only writer of the Notification table.
 * FAIL-SOFT contract (backend-agent): a notification failure must NEVER
 * break the caller (order placement, status change, stock adjustment). Every
 * helper swallows its own errors and logs — flows that wire notifications
 * through these helpers stay byte-identical whether the insert succeeds or
 * not. Callers pass the data they already hold in scope; no re-queries.
 */
import 'server-only';
import { prisma } from '@/lib/db';
import type { NotificationDTO, NotificationType } from '@/types/api';
import type { Notification } from '@prisma/client';

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

/** Inserts one notification for one user. Never throws into the caller. */
export async function notifyUser(userId: string, input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error('[zubeli] notification create failed:', error);
  }
}

/** Notifies every OWNER-role user (order placed, low stock, bank-transfer review). */
export async function notifyOwners(input: NotificationInput): Promise<void> {
  try {
    const owners = await prisma.user.findMany({ where: { role: 'OWNER' }, select: { id: true } });
    await Promise.all(owners.map((owner) => notifyUser(owner.id, input)));
  } catch (error) {
    console.error('[zubeli] notification owner lookup failed:', error);
  }
}

/** Notifies the customer attached to an order; guest orders (no userId) skip silently. */
export async function notifyOrderCustomer(
  order: { customerId: string | null },
  input: NotificationInput,
): Promise<void> {
  if (!order.customerId) return; // guest checkout — nowhere to notify
  await notifyUser(order.customerId, input);
}

/** Notifies the OWNERs about an order event (used at order placement). */
export async function notifyOrderOwners(order: { id: string }, input: NotificationInput): Promise<void> {
  await notifyOwners(input);
}

/** Prisma Notification → API contract (ADR 0004): ISO strings, nullable readAt. */
export function toNotificationDTO(row: Notification): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}