"use client";
import { useState } from "react";
import { Dialog, IconMenu } from "@/components/ui";
import { SidebarNav } from "./SidebarNav";

/**
 * Mobile admin navigation — hamburger (lg:hidden) opening a slide-in drawer
 * with the same nav list as the desktop sidebar. Focus-trapped Dialog from
 * the design system; Esc/overlay dismiss.
 */
export function MobileAdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="-ml-2 flex h-11 items-center rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink lg:hidden"
      >
        <IconMenu className="size-5" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Admin menu" side="end">
        <nav aria-label="Admin" className="px-3 py-4">
          <SidebarNav variant="light" onNavigate={() => setOpen(false)} />
        </nav>
      </Dialog>
    </>
  );
}