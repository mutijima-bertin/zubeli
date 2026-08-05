/**
 * Middleware — FIRST-LAYER UX redirects only (ADR 0002).
 * Real enforcement is always requireUser/requireAdmin at the top of every
 * action; middleware is never the control (defense in depth).
 *
 * - /admin/*  → no session: redirect /login?next=…; session but not OWNER: redirect /
 * - /account/* → no session: redirect /login?next=…
 * - /checkout, /products, … public (guest checkout is allowed)
 *
 * Node.js runtime so the DB-backed session can be validated here
 * (Next.js 15.5 stable nodejs middleware).
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, getSessionUserByToken } from '@/lib/auth/session-token';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUserByToken(token);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = new URL('/login', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    if (user.role !== 'OWNER') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // /account/*
  if (!user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
  runtime: 'nodejs',
};
