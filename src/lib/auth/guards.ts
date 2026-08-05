/**
 * RBAC guards — the single admin gate used by every admin action.
 * `assertAdmin` is pure (unit-testable without request scope);
 * `requireAdminOrThrow` is the request-bound variant.
 */
import 'server-only';
import type { User } from '@prisma/client';
import { NotAuthorizedError } from '@/lib/errors';
import { getSession } from './session';

/** Pure role check — throws NotAuthorizedError (401 no session / 403 non-owner). */
export function assertAdmin(user: User | null): asserts user is User {
  if (!user) throw new NotAuthorizedError('You must be signed in', 401);
  if (user.role !== 'OWNER') throw new NotAuthorizedError('Admin access required', 403);
}

/** First line of every admin action (backend-patterns, security-review). */
export async function requireAdminOrThrow(): Promise<User> {
  const user = await getSession();
  assertAdmin(user);
  return user;
}
