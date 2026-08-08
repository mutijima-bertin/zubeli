"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/actions/account";
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
 * Profile form (Phase C-5 — account-agent). Prefilled from the server
 * session (uncontrolled inputs); saves name + phone via updateProfileAction
 * (email is read-only — the schema has no email field). On success the page
 * refreshes so the header shows the new name.
 */
export function ProfileForm({
  initialEmail,
  initialName,
  initialPhone,
}: {
  initialEmail: string;
  initialName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<UserDTO> | null>(null);

  const success = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;
  const fieldErrors = getFieldErrors(error?.details);
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await updateProfileAction({
        name: formData.get("name") ?? "",
        phone: formData.get("phone") ?? "",
      });
      if (res.ok) {
        setResult(res);
        router.refresh(); // header + prefill props reflect the new name
      } else {
        setResult(res);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {success && (
        <Alert tone="success" title="Profile updated">
          Your details have been saved.
        </Alert>
      )}
      {pageError && (
        <Alert tone="danger" title="Couldn't save your profile">
          {pageError.message}
        </Alert>
      )}

      <FormField label="Email" hint="Your email can't be changed here.">
        <Input type="email" value={initialEmail} readOnly aria-readonly="true" />
      </FormField>

      <FormField label="Full name" required error={fieldErrors.name}>
        <Input
          type="text"
          name="name"
          autoComplete="name"
          required
          defaultValue={initialName}
        />
      </FormField>

      <FormField
        label="Phone"
        hint="Used for delivery calls and payment confirmations. Leave empty to remove."
        error={fieldErrors.phone}
      >
        <Input type="tel" name="phone" autoComplete="tel" defaultValue={initialPhone} />
      </FormField>

      <Button type="submit" loading={isPending} className="mt-2">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
