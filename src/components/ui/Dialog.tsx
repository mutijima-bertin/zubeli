"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./icons";
import { cx } from "./utils";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Visible heading — becomes the accessible name (aria-labelledby). */
  title?: string;
  /** Fallback accessible name when no title is rendered. */
  label?: string;
  /** `center` = modal dialog; `end` = slide-in panel (mobile menu). */
  side?: "center" | "end";
  showClose?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Accessible dialog: `role="dialog"` + `aria-modal`, focus is trapped while
 * open and restored on close, Esc and overlay click dismiss, body scroll is
 * locked. Rendered through a portal onto `document.body`.
 */
export function Dialog({
  open,
  onClose,
  title,
  label,
  side = "center",
  showClose = true,
  children,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    let cancelled = false;

    function getFocusable(): HTMLElement[] {
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    // Focus the first focusable control, else the panel itself (purely
    // informational dialogs have no controls).
    function focusIntoPanel(preferLast = false) {
      if (!panel) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        panel.focus();
        return;
      }
      (preferLast ? focusable[focusable.length - 1] : focusable[0]).focus();
    }

    if (panel) panel.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // A control that becomes disabled (e.g. a loading Button) or unmounts drops
    // focus to <body>; the next Tab could then reach background content. Pull
    // focus back into the panel on the next tick.
    function onFocusOut() {
      window.setTimeout(() => {
        if (cancelled || !panel || !panel.isConnected) return;
        const active = document.activeElement;
        if (!active || active === document.body || !panel.contains(active)) {
          focusIntoPanel();
        }
      }, 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!active || !panel.contains(active)) {
        // Focus escaped (e.g. control disabled) — wrap instead of letting Tab
        // reach background content.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === panel)) {
        // Shift+Tab from the first control, or from the panel itself where
        // focus starts (tabIndex=-1), wraps to the last control.
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    panel?.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      panel?.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const panel = (
    <div
      className={cx(
        "fixed inset-0 z-50 flex",
        side === "end" ? "items-stretch justify-end" : "items-center justify-center p-4",
      )}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-ink-dark/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? label : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-full flex-col outline-none",
          side === "center"
            ? "w-full max-w-md animate-zoom-in overflow-hidden rounded-xl bg-white shadow-pop"
            : "h-full w-full max-w-sm animate-slide-in-right bg-white shadow-pop sm:max-w-md",
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
            {title ? (
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
              >
                <IconX className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(panel, document.body);
}