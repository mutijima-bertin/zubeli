"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { IconAlert, IconCheck, IconInfo, IconWarning, IconX } from "./icons";
import { cx } from "./utils";

export type ToastTone = "info" | "success" | "warning" | "danger";
export type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 5000). */
  durationMs?: number;
};
type ToastEntry = { id: string } & ToastInput;

const toneClasses: Record<ToastTone, { border: string; text: string }> = {
  info: { border: "border-sky-200", text: "text-sky-600" },
  success: { border: "border-success-100", text: "text-success-600" },
  warning: { border: "border-amber-200", text: "text-amber-600" },
  danger: { border: "border-danger-100", text: "text-danger-600" },
};

const toneIcons: Record<ToastTone, (props: { className?: string }) => React.ReactNode> = {
  info: (props) => <IconInfo {...props} />,
  success: (props) => <IconCheck {...props} />,
  warning: (props) => <IconAlert {...props} />,
  danger: (props) => <IconWarning {...props} />,
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toast context + viewport. Mount once (storefront layout) so any client
 * component can announce feedback via `useToast().toast({...})`. The
 * viewport is an `aria-live="polite"` region — announcements are read out
 * without stealing focus.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const entry: ToastEntry = { id, tone: input.tone ?? "info", ...input };
      setItems((prev) => [...prev.slice(-3), entry]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), input.durationMs ?? 5000),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col items-end gap-2 px-4"
      >
        {items.map((entry) => (
          <ToastCard key={entry.id} item={entry} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  const Icon = toneIcons[item.tone ?? "info"];
  return (
    <div
      className={cx(
        "pointer-events-auto flex w-full max-w-sm animate-slide-in-up items-start gap-3 rounded-xl border bg-white p-4 shadow-pop",
        toneClasses[item.tone ?? "info"].border,
      )}
    >
      <span className={cx("mt-0.5 shrink-0", toneClasses[item.tone ?? "info"].text)} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        {item.message && <p className="mt-0.5 text-sm text-stone-600">{item.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-ink"
      >
        <IconX className="size-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}