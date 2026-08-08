"use client";
import { cloneElement, isValidElement, useId } from "react";
import { Label } from "./Label";
import { cx } from "./utils";

export type FieldError = string | string[] | null | undefined;

/**
 * Label + control + hint + error with automatic id/aria wiring.
 * The control child (Input / Select / Textarea) receives `id`,
 * `aria-invalid` and `aria-describedby` — screens never pass ids manually.
 *
 * @example
 * <FormField label="Email" hint="We only use this for order updates" error={result.error?.details?.fieldErrors?.email}>
 *   <Input type="email" autoComplete="email" />
 * </FormField>
 */
export function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  className,
  children,
}: {
  id?: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: FieldError;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorText = Array.isArray(error) ? error.join(" ") : error;
  const describedBy =
    [errorText ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null].filter(Boolean).join(" ") ||
    undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        "aria-invalid": errorText ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={cx("w-full", className)}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      {control}
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