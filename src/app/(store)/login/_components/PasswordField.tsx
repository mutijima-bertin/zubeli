"use client";
/**
 * Password input with show/hide toggle (ui-ux-pro-max audit #13a).
 *
 * Local to account-agent's auth forms — the ui/* foundation owns FormField,
 * so this field re-implements its label/hint/error wiring (same markup and
 * aria pattern: id, aria-invalid, aria-describedby, role="alert" error) with
 * the toggle button living inside the input.
 *
 * Toggle naming: the button's accessible name comes from visually-hidden
 * TEXT ("Show password" / "Hide password"), NOT aria-label. Playwright's
 * getByLabel engine matches aria-label names, so an aria-label toggle would
 * make getByLabel("Password") match two nodes and break the e2e POs that
 * drive login/register by label (verified empirically: label engine matches
 * INPUT + BUTTON with aria-label="Show password"). The announced name is
 * identical either way (WCAG 2.1 — name from content).
 */
import { useId, useState } from "react";
import { Input, Label } from "@/components/ui";

type FieldError = string | string[] | null | undefined;

function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      {off ? (
        <>
          <path d="m4.5 4.5 15 15" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      ) : (
        <circle cx="12" cy="12" r="2.6" />
      )}
    </svg>
  );
}

export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  required = false,
  hint,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: FieldError;
}) {
  const fieldId = useId();
  const [visible, setVisible] = useState(false);

  const errorText = Array.isArray(error) ? error.join(" ") : error;
  const describedBy =
    [errorText ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="w-full">
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>

      <div className="relative">
        <Input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          invalid={Boolean(errorText)}
          aria-describedby={describedBy}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 transition-colors hover:text-ink active:text-ink"
        >
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
          <EyeIcon off={visible} />
        </button>
      </div>

      {hint && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {errorText && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-sm text-danger-600">
          {errorText}
        </p>
      )}
    </div>
  );
}
