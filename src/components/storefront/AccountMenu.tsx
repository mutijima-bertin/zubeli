"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/actions/auth";
import { IconChevronDown, IconUser } from "@/components/ui";
import { cx } from "@/components/ui";

export type AccountMenuUser = { name: string; email: string; role?: "OWNER" | "CUSTOMER" } | null;

/**
 * Account entry point: guest → "Sign in"; signed-in → name dropdown with
 * role-appropriate links + sign-out. OWNER sees "Admin panel" (→ /admin)
 * instead of the customer-account links. Click-outside and Esc close the
 * menu; the toggle button carries aria-expanded/haspopup (disclosure pattern).
 */
export function AccountMenu({ user }: { user: AccountMenuUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await logoutAction();
    setOpen(false);
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-stone-50"
      >
        <IconUser className="size-4" />
        Sign in
      </Link>
    );
  }

  const isOwner = user.role === "OWNER";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-stone-100"
      >
        <IconUser className="size-5" />
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
        <IconChevronDown className={cx("size-4 text-stone-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-pop">
          <div className="border-b border-stone-100 px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <div className="flex flex-col pt-1">
            {isOwner ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-stone-50"
              >
                <span className="font-semibold">Admin panel</span>
                <span className="text-xs font-normal text-stone-500">
                  Manage products, orders &amp; stock
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-stone-50"
                >
                  My account
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-stone-50"
                >
                  Order history
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="mt-1 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}