import Link from "next/link";
import { IconStore } from "./icons";
import { SidebarNav } from "./SidebarNav";

/**
 * Desktop admin sidebar — dark charcoal (own dashboard tokens, never the
 * storefront design system). Sticky full-height rail on lg+ screens;
 * mobile uses `MobileAdminNav` instead.
 */
export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-ink-dark text-stone-300 lg:flex">
      <div className="flex items-baseline gap-1.5 border-b border-white/10 px-5 py-5">
        <Link
          href="/admin"
          className="text-lg font-bold tracking-tight text-white"
        >
          Zubeli
        </Link>
        <span className="text-xs font-medium text-stone-500">Admin</span>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav variant="dark" />
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <IconStore className="size-5 shrink-0" />
          View storefront
        </Link>
      </div>
    </aside>
  );
}