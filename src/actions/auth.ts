'use server';
/**
 * Auth actions (ADR 0002/0004). Return ActionResult<T> — never throw across
 * the boundary. Login/register are rate-limited by IP (+email for login).
 */
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, getSession } from '@/lib/auth/session';
import { createUser, findByEmail } from '@/lib/db/users';
import { clientIp } from '@/lib/request';
import { assertRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ConflictError, NotAuthorizedError, toActionResult } from '@/lib/errors';
import { toUserDTO } from '@/lib/dto';
import type { ActionResult, UserDTO } from '@/types/api';

// Equalize bcrypt timing when the email does not exist (uniform timing).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('zubeli-dummy-password-2026');
  return dummyHashPromise;
}

export async function registerAction(input: unknown): Promise<ActionResult<UserDTO>> {
  try {
    const data = registerSchema.parse(input);
    await assertRateLimit(`register:${await clientIp()}`, RATE_LIMITS.register);

    if (await findByEmail(data.email)) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await createUser({ email: data.email, passwordHash, name: data.name, phone: data.phone });
    await createSession(user.id); // one fresh session, previous ones revoked (ADR 0002)

    return { ok: true, data: toUserDTO(user) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function loginAction(input: unknown): Promise<ActionResult<UserDTO>> {
  try {
    const data = loginSchema.parse(input);
    await assertRateLimit(`login:${await clientIp()}:${data.email}`, RATE_LIMITS.login);

    const user = await findByEmail(data.email);
    const hash = user?.passwordHash ?? (await getDummyHash());
    const valid = await verifyPassword(data.password, hash);
    if (!user || !valid) {
      throw new NotAuthorizedError('Invalid email or password', 401);
    }

    await createSession(user.id);
    return { ok: true, data: toUserDTO(user) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function logoutAction(): Promise<ActionResult<{ success: true }>> {
  try {
    await destroySession();
    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getSessionAction(): Promise<ActionResult<UserDTO | null>> {
  try {
    const user = await getSession();
    return { ok: true, data: user ? toUserDTO(user) : null };
  } catch (error) {
    return toActionResult(error);
  }
}
