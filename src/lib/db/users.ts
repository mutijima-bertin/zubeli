/**
 * User queries — auth-adjacent lookups only (hashing, sessions and RBAC
 * decisions live in backend-agent's domain; this is the thin data layer).
 * Emails are stored lowercased (ADR 0001) — enforced on write and on lookup.
 */
import { prisma } from '../db';

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
};

export async function createUser({ email, passwordHash, name, phone }: CreateUserInput) {
  return prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      passwordHash,
      name,
      phone: phone ?? null,
    },
  });
}

export type UpdateProfileInput = {
  name?: string;
  phone?: string | null; // pass null to clear
};

export async function updateProfile(id: string, data: UpdateProfileInput) {
  return prisma.user.update({ where: { id }, data });
}
