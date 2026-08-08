"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
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
 * Sign-in form (Phase C-5 — account-agent). Submits to loginAction; on
 * success pushes the (server-sanitized) `?next` destination, or /account
 * (or /admin for OWNERs without an explicit ?next). Page-level errors
 * (wrong credentials, rate limit) render in an Alert; field-level Zod
 * errors render under their inputs via FormField.
 */
export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<UserDTO> | null>(null);

  const error = result && !result.ok ? result.error : null;
  const fieldErrors = getFieldErrors(error?.details);
  // Field-level errors are rendered per-input; anything else is page-level.
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await loginAction(Object.fromEntries(formData.entries()));
      if (res.ok) {
        // Owners land on the dashboard unless they came with an explicit
        // `?next` (e.g. middleware bouncing /admin → /login?next=%2Fadmin).
        const dest =
          res.data.role === "OWNER" && nextPath === "/account"
            ? "/admin"
            : nextPath;
        router.push(dest);
        router.refresh();
      } else {
        setResult(res);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {pageError && (
        <Alert tone="danger" title="Sign in failed">
          {pageError.message}
        </Alert>
      )}

      <FormField
        label="Email"
        required
        error={fieldErrors.email}
        hint="The email you registered with."
      >
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </FormField>

      <FormField label="Password" required error={fieldErrors.password}>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
      </FormField>

      <Button type="submit" fullWidth size="lg" loading={isPending} className="mt-2">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
