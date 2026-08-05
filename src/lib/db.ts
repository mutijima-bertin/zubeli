/**
 * PrismaClient singleton — one shared instance with a connection pool.
 * Cached on globalThis in dev so hot reload does not exhaust connections
 * (see .opencode/skills/prisma-patterns/SKILL.md).
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
