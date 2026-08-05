/**
 * Session token primitives — pure row operations, no request scope.
 * DB stores only sha256(token) hex (ADR 0002); the raw token lives in the
 * `zubeli_session` httpOnly cookie. This module is deliberately free of
 * next/headers imports so middleware and unit tests can use it.
 */
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import type { User } from '@prisma/client';

export const SESSION_COOKIE = 'zubeli_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ROTATE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // rotate token on activity older than 7 days

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Issue a session row and return the raw token (returned exactly once).
 * Rotation on login: deletes the user's previous sessions (ADR 0002 —
 * kills session fixation and stale devices).
 */
export async function createSessionRow(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt } }),
  ]);
  return { token, expiresAt };
}

/** Validates a raw cookie token against the DB (expiry check). No writes. */
export async function getSessionUserByToken(token: string | null | undefined): Promise<User | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session.user;
}

export async function destroySessionRow(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Issues a fresh token for the same session row (same expiry — no sliding renewal). */
export async function rotateSessionRow(token: string): Promise<{ token: string; expiresAt: Date } | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  if (!session) return null;
  const next = newSessionToken();
  await prisma.$transaction([
    prisma.session.delete({ where: { id: session.id } }),
    prisma.session.create({
      data: { tokenHash: hashSessionToken(next), userId: session.userId, expiresAt: session.expiresAt },
    }),
  ]);
  return { token: next, expiresAt: session.expiresAt };
}
