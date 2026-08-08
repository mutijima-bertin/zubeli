import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui";
import { LoginForm } from "./_components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Zubeli",
  description:
    "Sign in to your Zubeli account to track orders, manage your details and check out faster.",
};

/** Default destination when `?next` is absent or rejected. */
const DEFAULT_NEXT = "/account";

/**
 * Auth routes are never valid post-login destinations: bounces them here
 * would loop a signed-in visitor between the page and itself
 * (ERR_TOO_MANY_REDIRECTS).
 */
const AUTH_ROUTES = new Set(["/login", "/register"]);

/**
 * Anti open-redirect: only same-site relative paths are allowed. Anything
 * else — absolute URLs (https://…), protocol-relative (//…), backslash
 * tricks (/\…) — plus the auth routes themselves — falls back to
 * DEFAULT_NEXT.
 */
export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.startsWith("/\\") || value.startsWith("\\")) return DEFAULT_NEXT;
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  // Bare pathname (query/hash stripped, trailing slashes ignored) so
  // /login, /login/, /login?next=… all resolve to the auth route.
  const pathname = value.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (AUTH_ROUTES.has(pathname)) return DEFAULT_NEXT;
  return value;
}

/**
 * Sign-in screen (Phase C-5 — account-agent). Server shell: reads the
 * `?next` search param (set by middleware when a protected /account route
 * bounced an anonymous visitor), sanitizes it, and lets signed-in users
 * skip the form entirely. The client LoginForm calls loginAction and then
 * pushes the sanitized destination.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeNextPath(Array.isArray(next) ? next[0] : next);

  const session = await getSession();
  if (session) redirect(nextPath);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Card>
        <CardBody>
          <div className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-stone-600">
              Welcome back — track your orders and check out faster.
            </p>
          </div>

          <div className="mt-6">
            <LoginForm nextPath={nextPath} />
          </div>

          <p className="mt-6 border-t border-stone-100 pb-2 pt-5 text-center text-sm text-stone-600">
            New to Zubeli?{" "}
            <Link
              href="/register"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
