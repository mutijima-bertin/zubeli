"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUnreadNotificationsCountAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import type { NotificationDTO } from "@/types/api";
import { IconBell } from "./icons";
import { Skeleton } from "./Skeleton";
import { cx } from "./utils";

/** Poll cadence for the unread badge (25s) + on window focus/visibility. */
const POLL_INTERVAL_MS = 25_000;
/** Panel shows the latest N notifications (action default is 10). */
const PANEL_LIMIT = 10;

/**
 * Notification bell — unread-count badge + dropdown panel of the latest
 * notifications. Lives in the design system so the admin topbar can reuse
 * it with the same props. `userId` only gates mounting (the actions read
 * the session server-side); the component stays fail-soft: any action
 * failure keeps the previous state and never breaks the header.
 *
 * Freshness: count on mount, then every 25s + on window focus / returning
 * to a visible tab; the panel list refetches on open, on the same poll tick
 * while open, and after any local mark-read mutation.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshCount = useCallback(async () => {
    const result = await getUnreadNotificationsCountAction();
    if (result.ok) setCount(result.data.count);
  }, []);

  const refreshItems = useCallback(async () => {
    const result = await listNotificationsAction({ limit: PANEL_LIMIT });
    if (result.ok) {
      setItems(result.data.items);
      setLoaded(true);
    }
  }, []);

  // Badge on mount / when the user changes.
  useEffect(() => {
    void refreshCount();
  }, [userId, refreshCount]);

  // Freshness: poll every 25s, and refetch on focus / tab re-visible.
  useEffect(() => {
    function refocus() {
      void refreshCount();
      if (openRef.current) void refreshItems();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refocus();
    }
    const timer = window.setInterval(refocus, POLL_INTERVAL_MS);
    window.addEventListener("focus", refocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshCount, refreshItems]);

  // Esc + click-outside close (AccountMenu pattern — disclosure, no trap).
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

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void refreshItems();
  }

  /** Row click: mark read (fire-and-forget, fail-soft) then let Link navigate. */
  function handleRowClick(notification: NotificationDTO) {
    if (!notification.readAt) {
      const now = new Date().toISOString();
      setItems((list) =>
        list.map((item) => (item.id === notification.id ? { ...item, readAt: now } : item)),
      );
      setCount((value) => Math.max(0, value - 1));
      markNotificationReadAction({ notificationId: notification.id })
        .then((result) => {
          if (!result.ok) void refreshCount(); // reconcile on failure
        })
        .catch(() => {
          /* fail-soft — the next poll reconciles */
        });
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    const previousItems = items;
    const previousCount = count;
    const now = new Date().toISOString();
    setItems((list) => list.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setCount(0);
    const result = await markAllNotificationsReadAction();
    if (!result.ok) {
      setItems(previousItems);
      setCount(previousCount);
      return;
    }
    void refreshCount(); // reconcile with server truth
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-stone-100"
      >
        <IconBell className="size-6" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cta-600 px-1 text-xs font-bold text-ink-dark">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-pop">
          <ul className="max-h-96 overflow-y-auto overscroll-contain p-2">
            {!loaded ? (
              <li aria-hidden="true" className="flex flex-col gap-2 p-1">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </li>
            ) : items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-stone-500">No notifications yet</li>
            ) : (
              items.map((notification) => {
                const unread = notification.readAt === null;
                return (
                  <li key={notification.id}>
                    <Link
                      href={notification.link ?? "/account"}
                      onClick={() => handleRowClick(notification)}
                      className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-stone-50"
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          unread ? "bg-cta-600" : "bg-transparent",
                        )}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className={cx(
                            "text-sm",
                            unread ? "font-semibold text-ink" : "font-medium text-stone-600",
                          )}
                        >
                          {notification.title}
                        </span>
                        {notification.body && (
                          <span className="text-xs leading-relaxed text-stone-500">
                            {notification.body}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>

          {loaded && items.length > 0 && (
            <div className="border-t border-stone-100 p-2">
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}