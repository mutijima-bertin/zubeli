'use server';
/**
 * Notification actions (customer + OWNER bell). Every action calls
 * requireUser first — notifications are per-user; the same actions serve
 * both roles. All reads are scoped to the session user's own rows (IDOR
 * safe): list/count filter by userId, mark-read uses `{ id, userId }`
 * so a foreign notification id simply 404s.
 */
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { idCursor, normalizeLimit, toPage } from '@/lib/db/pagination';
import { requireUser } from '@/lib/auth/session';
import { toNotificationDTO } from '@/lib/notifications';
import { NotFoundError, toActionResult } from '@/lib/errors';
import type { ActionResult, NotificationDTO, Page } from '@/types/api';

const notificationListSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const notificationIdSchema = z.object({ notificationId: z.string().min(1) });

/** Own notifications, newest first, idCursor pagination (default 10, max 50). */
export async function listNotificationsAction(input: unknown): Promise<ActionResult<Page<NotificationDTO>>> {
  try {
    const user = await requireUser();
    const { cursor, limit } = notificationListSchema.parse(input);
    const take = normalizeLimit(limit, 10);
    const rows = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...idCursor(cursor),
    });
    const page = toPage(rows, take);
    return {
      ok: true,
      data: { items: page.items.map(toNotificationDTO), nextCursor: page.nextCursor, hasMore: page.hasMore },
    };
  } catch (error) {
    return toActionResult(error);
  }
}

/** Unread-badge count for the session user. */
export async function getUnreadNotificationsCountAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const count = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return { ok: true, data: { count } };
  } catch (error) {
    return toActionResult(error);
  }
}

/** Marks ONE of the user's own notifications read — foreign ids 404 (IDOR). */
export async function markNotificationReadAction(input: unknown): Promise<ActionResult<{ success: true }>> {
  try {
    const user = await requireUser();
    const { notificationId } = notificationIdSchema.parse(input);
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundError('Notification not found');
    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionResult(error);
  }
}

/** Marks ALL of the user's notifications read. */
export async function markAllNotificationsReadAction(): Promise<ActionResult<{ success: true }>> {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({ where: { userId: user.id }, data: { readAt: new Date() } });
    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionResult(error);
  }
}