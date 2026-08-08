"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { loginSchema } from "@/lib/validation/auth";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { ActionResult, UserDTO } from "@/types/api";
import { PasswordField } from "./PasswordField";

/** ZodError fieldErrors shape (src/lib/errors.ts toActionResult). */
type FieldErrors = Record<string, string[] | undefined>;

function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}

/** Flatten a client-side zod failure into the same fieldErrors shape. */
function zodFieldErrors(error: {
  issues: Array<{ path: Array<string | number | symbol>; message: string }>;
}): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (!key) continue;
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Sign-in form (Phase C-5 — account-agent; audit #13 — account-agent).
 * Submits to loginAction; on success pushes the (server-sanitized) `?next`
 * destination, or /account (or /admin for OWNERs without an explicit ?next).
 * Page-level errors (wrong credentials, rate limit) render in an Alert;
 * field-level errors render under their inputs via FormField.
 *
 * Client pre-check (audit #13b — parity with checkout §R8): loginSchema is
 * ran client-side before the action so common mistakes fail instantly. The
 * server stays authoritative — loginAction re-validates with the same schema.
 */
export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<UserDTO> | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const error = result && !result.ok ? result.error : null;
  const serverErrors = getFieldErrors(error?.details);
  // Lightweight pre-check errors show until the next submit (server errors
  // win where they overlap, mirroring CheckoutFlow).
  const fieldErrors: FieldErrors = { ...clientErrors, ...serverErrors };
  // Field-level errors are rendered per-input; anything else is page-level.
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setClientErrors(zodFieldErrors(parsed.error));
      return;
    }
    setClientErrors({});
    setResult(null);

    startTransition(async () => {
      const res = await loginAction(values);
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

      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        required
        error={fieldErrors.password}
      />

      <Button type="submit" fullWidth size="lg" loading={isPending} className="mt-2">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}