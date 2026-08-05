/**
 * Password hashing (ADR 0002): bcryptjs — pure JS, no native build risk.
 * Cost factor from BCRYPT_ROUNDS env (default 10, tunable to 12).
 * Swapping to argon2id later is a one-file change.
 */
import 'server-only';
import { hash, compare } from 'bcryptjs';

function parseRounds(): number {
  const raw = process.env.BCRYPT_ROUNDS;
  if (!raw) return 10;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 4 && n <= 15 ? n : 10;
}

const BCRYPT_ROUNDS = parseRounds();

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

/** Constant-time-ish comparison (bcrypt internally). Never reveals which part failed. */
export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}
