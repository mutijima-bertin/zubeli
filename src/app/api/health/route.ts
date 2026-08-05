/**
 * Internal health endpoint (ADR 0004 — the only route handler in the MVP).
 * Liveness + DB connectivity check. Not part of an external API (no /api/v1).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'up' });
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
