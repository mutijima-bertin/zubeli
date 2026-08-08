"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/actions/auth";
import { registerSchema } from "@/lib/validation/auth";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { ActionResult, UserDTO } from "@/types/api";
import { PasswordField } from "../../login/_components/PasswordField";

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
 * Registration form (Phase C-5 — account-agent; audit #13 — account-agent).
 * registerAction creates the account and a session in one call, so success
 * navigates straight to /account (password hint mirrors registerSchema:
 * min 8, max 72 chars).
 *
 * Client pre-check (audit #13b — parity with checkout §R8): registerSchema
 * runs client-side before the action so empty/malformed fields and short
 * passwords fail instantly; the optional "Confirm" field adds a client-only
 * typo guard (passwords don't match). The server stays authoritative —
 * registerAction re-validates with the same schema (zod strips the
 * confirmPassword key, which the schema doesn't know).
 */
export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<UserDTO> | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const error = result && !result.ok ? result.error : null;
  const serverErrors = getFieldErrors(error?.details);
  const fieldErrors: FieldErrors = { ...clientErrors, ...serverErrors };
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());

    // Server rules first (same schema the action parses)…
    const parsed = registerSchema.safeParse(values);
    const errors: FieldErrors = parsed.success
      ? {}
      : zodFieldErrors(parsed.error);

    // …then the client-only confirm guard: only enforced when the user
    // typed into both fields (the confirm field is optional — see below).
    const confirmPassword = values.confirmPassword;
    if (
      typeof confirmPassword === "string" &&
      confirmPassword.length > 0 &&
      confirmPassword !== values.password
    ) {
      errors.confirmPassword = ["Passwords don't match"];
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    setResult(null);

    startTransition(async () => {
      const res = await registerAction(values);
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

      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="Choose a strong password"
        required
        hint="At least 8 characters."
        error={fieldErrors.password}
      />

      <PasswordField
        label="Confirm"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Repeat your password"
        hint="Re-enter the password you chose above to catch typos."
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" fullWidth size="lg" loading={isPending} className="mt-2">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}