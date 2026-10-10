"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/actions/admin/categories";
import { Alert, Button, FormField, Input, Textarea } from "@/components/ui";
import { CATEGORY_SLUG_PATTERN, categorySlugify } from "@/lib/validation/category";
import type { AdminCategory } from "@/lib/db/categories";
import type { ActionResult } from "@/types/api";

/** ZodError fieldErrors shape (src/lib/errors.ts toActionResult). */
type FieldErrors = Record<string, string[] | undefined>;

function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}

function messageOf(errors: string[] | undefined): string | undefined {
  return errors?.join(" ");
}

/**
 * Category create/edit form (/admin/categories/new + /[id]/edit). Mirrors
 * ProductForm: noValidate — the server zod schemas are authoritative and
 * their fieldErrors land on the matching inputs; the local checks below only
 * short-circuit obviously bad input before a round-trip.
 *
 * Slug rules (create): optional, auto-derived from the name when blank
 * (preview shown). On edit the slug is NEVER re-derived — renaming a
 * category must not silently change storefront URLs.
 */
export function CategoryForm({ initial }: { initial?: AdminCategory }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<AdminCategory> | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  const error = result && !result.ok ? result.error : null;
  const serverFieldErrors = getFieldErrors(error?.details);
  const fieldErrors: FieldErrors = { ...serverFieldErrors, ...localErrors };
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const pageError =
    error && (error.code !== "VALIDATION" || !hasFieldErrors) ? error : null;

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const derivedSlug = categorySlugify(trimmedName);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (trimmedName.length < 2) errors.name = ["Name is required (at least 2 characters)."];
    if (trimmedSlug.length > 0) {
      if (trimmedSlug.length < 2) {
        errors.slug = ["Slug is required (at least 2 characters)."];
      } else if (!CATEGORY_SLUG_PATTERN.test(trimmedSlug)) {
        errors.slug = ["Slug: lowercase letters, digits and dashes only."];
      }
    }
    if (description.trim().length > 2000) {
      errors.description = ["Description must be 2000 characters or fewer."];
    }
    return errors;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const errors = validate();
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const res = initial
        ? await updateCategory(initial.id, {
            name: trimmedName,
            // Blank slug = leave the existing one untouched (never re-derived).
            slug: trimmedSlug || undefined,
            description, // '' clears the column on update
            isActive,
          })
        : await createCategory({
            name: trimmedName,
            slug: trimmedSlug || undefined, // omitted → server derives from name
            description: description || undefined,
            isActive,
          });

      if (res.ok) {
        if (initial) {
          setResult(res);
          // Re-sync local form state from persisted data.
          setName(res.data.name);
          setSlug(res.data.slug);
          setDescription(res.data.description ?? "");
          setIsActive(res.data.isActive);
          router.refresh();
        } else {
          router.push("/admin/categories");
          router.refresh();
        }
      } else {
        setResult(res);
      }
    });
  }

  const slugHint = initial
    ? `Renaming won't change the URL — the slug stays “${initial.slug}” unless you edit it.`
    : trimmedSlug.length > 0
      ? "Lowercase letters, digits and dashes — used in the storefront URL."
      : derivedSlug
        ? `Left blank — it will be “${derivedSlug}”.`
        : "Optional — derived from the name when left blank.";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {pageError && (
        <Alert tone="danger" title={initial ? "Couldn't save changes" : "Couldn't create category"}>
          {pageError.message}
        </Alert>
      )}
      {result?.ok && initial && (
        <Alert tone="success" title="Category saved">
          Changes to {result.data.name} were saved.
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Name"
          required
          error={messageOf(fieldErrors.name)}
          hint="Shown in the storefront navigation and catalog filters."
          className="md:col-span-2"
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Power Tools"
            required
            maxLength={100}
          />
        </FormField>

        <FormField
          label="Slug"
          error={messageOf(fieldErrors.slug)}
          hint={slugHint}
          className="md:col-span-2"
        >
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="e.g. power-tools"
            maxLength={160}
          />
        </FormField>

        <FormField
          label="Description"
          error={messageOf(fieldErrors.description)}
          hint="Optional. One or two lines about what the category covers."
          className="md:col-span-2"
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. Drills, saws and grinders for professional sites."
          />
        </FormField>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-card">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="size-4 accent-brand-700"
        />
        <span>
          <span className="block text-sm font-semibold text-ink">Active</span>
          <span className="block text-xs text-stone-500">
            {isActive
              ? "Shown in the storefront nav, homepage showcase and catalog filters."
              : "Hidden from the storefront nav — its products stay published and sellable."}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" href="/admin/categories">
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {initial ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
