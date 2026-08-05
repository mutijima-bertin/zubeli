/**
 * Request-scope helpers for server actions.
 */
import 'server-only';
import { headers } from 'next/headers';

/**
 * Best-effort client identifier for rate limiting. Behind a proxy the real
 * IP arrives via x-forwarded-for; in `next dev` (no proxy) it falls back to
 * a constant — all local requests share one bucket, which is fine for the demo.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}
