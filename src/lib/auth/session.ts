/**
 * Session management — DB-backed sessions (ADR 0002).
 * Cookie `zubeli_session` = raw random token; DB stores sha256(token) only.
 * Guards: requireUser / requireAdmin are the real enforcement layer — the
 * middleware redirect is UX only (defense in depth, security-review).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { NotAuthorizedError } from '@/lib/errors';
import type { User } from '@prisma/client';
import {
  SESSION_COOKIE,
  ROTATE_AFTER_MS,
  createSessionRow,
  destroySessionRow,
  hashSessionToken,
  rotateSessionRow,
} from './session-token';

const LAST_USED_THROTTLE_MS = 60 * 60 * 1000; // persist lastUsedAt at most hourly

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  };
}

/** Login / register: issues a session row and sets the cookie. */
export async function createSession(userId: string): Promise<void> {
  const { token } = await createSessionRow(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());
}

/**
 * Resolves the current user from the session cookie, or null.
 * Rotates the token when the session is older than 7 days of inactivity
 * (task spec) and throttled-updates lastUsedAt (ADR 0002).
 */
export async function getSession(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  const lastUsedAt = session.lastUsedAt?.getTime() ?? session.createdAt.getTime();
  const now = Date.now();

  if (now - lastUsedAt > ROTATE_AFTER_MS) {
    const rotated = await rotateSessionRow(token);
    if (rotated) store.set(SESSION_COOKIE, rotated.token, cookieOptions());
  } else if (now - lastUsedAt > LAST_USED_THROTTLE_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
  }

  return session.user;
}

/** Logout: deletes the session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySessionRow(token);
  store.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
}

/** Real auth check — throws NotAuthorizedError (401) when there is no valid session. */
export async function requireUser(): Promise<User> {
  const user = await getSession();
  if (!user) throw new NotAuthorizedError('You must be signed in', 401);
  return user;
}

/** Admin guard — requireUser + OWNER role, else NotAuthorizedError (403). */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'OWNER') throw new NotAuthorizedError('Admin access required', 403);
  return user;
}
