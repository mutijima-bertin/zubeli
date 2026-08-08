"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { ADMIN_NAV_ITEMS } from "./nav";

/**
 * Active-link nav list. Rendered inside the dark desktop sidebar
 * (variant="dark") and the white mobile drawer (variant="light").
 * `aria-current="page"` marks the active entry; screens never touch this —
 * the layout mounts it automatically.
 */
export function SidebarNav({
  variant = "dark",
  onNavigate,
}: {
  variant?: "dark" | "light";
  /** Called after a link is followed (mobile drawer closes itself). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                variant === "dark"
                  ? cx(
                      "text-stone-400 hover:bg-white/5 hover:text-white",
                      active && "bg-white/10 text-white",
                    )
                  : cx(
                      "text-stone-600 hover:bg-stone-100 hover:text-ink",
                      active && "bg-brand-50 font-semibold text-brand-900",
                    ),
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}