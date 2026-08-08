"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/actions/auth";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { ActionResult, UserDTO } from "@/types/api";

/** ZodError fieldErrors shape (src/lib/errors.ts toActionResult). */
type FieldErrors = Record<string, string[] | undefined>;

function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}

/**
 * Registration form (Phase C-5 — account-agent). registerAction creates
 * the account and a session in one call, so success navigates straight to
 * /account (password hint mirrors registerSchema: min 8, max 72 chars).
 */
export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<UserDTO> | null>(null);

  const error = result && !result.ok ? result.error : null;
  const fieldErrors = getFieldErrors(error?.details);
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await registerAction(Object.fromEntries(formData.entries()));
      if (res.ok) {
        router.push("/account");
        router.refresh();
      } else {
        setResult(res);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {pageError && (
        <Alert tone="danger" title="Couldn't create your account">
          {pageError.message}
        </Alert>
      )}

      <FormField label="Full name" required error={fieldErrors.name}>
        <Input
          type="text"
          name="name"
          autoComplete="name"
          required
          placeholder="e.g. Umutoni Alice"
        />
      </FormField>

      <FormField label="Email" required error={fieldErrors.email}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </FormField>

      <FormField
        label="Phone"
        hint="Optional — used for delivery calls and payment confirmations."
        error={fieldErrors.phone}
      >
        <Input
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="e.g. 0788 123 456"
        />
      </FormField>

      <FormField
        label="Password"
        required
        hint="At least 8 characters."
        error={fieldErrors.password}
      >
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          placeholder="Choose a strong password"
        />
      </FormField>

      <Button type="submit" fullWidth size="lg" loading={isPending} className="mt-2">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
