import Link from "next/link";
import type { User } from "@prisma/client";
import { NotificationBell } from "@/components/ui";
import { IconStore } from "./icons";
import { LogoutButton } from "./LogoutButton";
import { MobileAdminNav } from "./MobileAdminNav";

/**
 * Admin top bar — white, dense (56px). Left: mobile hamburger. Right:
 * "View storefront" link, logged-in-as email chip (server-rendered from the
 * guarded session — never trusted client input), the notification bell and
 * the sign-out button. OWNER-only: the admin layout guards the session
 * before this renders (non-OWNERs redirect to /).
 */
export function AdminTopBar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-stone-200 bg-white px-4 sm:px-6">
      <MobileAdminNav />

      <Link
        href="/"
        className="ml-auto hidden h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-ink transition-colors hover:bg-stone-50 sm:inline-flex"
      >
        <IconStore className="size-4" />
        Storefront
      </Link>

      <div className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" aria-hidden="true" />

      <div className="hidden max-w-56 text-right sm:block">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-stone-500">{user.email}</p>
      </div>

      <NotificationBell userId={user.id} />

      <LogoutButton />
    </header>
  );
}