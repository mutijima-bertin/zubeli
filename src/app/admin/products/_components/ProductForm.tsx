"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
} from "@/actions/admin/products";
import {
  Alert,
  Button,
  FormField,
  IconPlus,
  IconX,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { ActionResult, ProductDTO } from "@/types/api";

/** ZodError fieldErrors shape (src/lib/errors.ts toActionResult). */
type FieldErrors = Record<string, string[] | undefined>;

function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}

export type CategoryOption = { id: string; slug: string; name: string };

const MAX_IMAGES = 8;

/**
 * Product create/edit form (Inventory). Shared by /admin/products/new and
 * /admin/products/[id]/edit. Prices are entered in RWF (integer minor units
 * per ADR 0004 — 1 RWF = 1 unit, so the input value maps 1:1 to priceCents).
 * `initial` is undefined on the create screen. Field errors come from the
 * server-side zod validation (noValidate — server is authoritative).
 */
export function ProductForm({
  categories,
  initial,
  isPublished,
  onIsPublishedChange,
  featured,
  onFeaturedChange,
}: {
  categories: CategoryOption[];
  /** Present on the edit screen (pre-filled); absent on create. */
  initial?: ProductDTO;
  /** Controlled variant (edit screen) — lets a sibling quick-action keep the checkbox in sync. */
  isPublished?: boolean;
  onIsPublishedChange?: (value: boolean) => void;
  featured?: boolean;
  onFeaturedChange?: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<ProductDTO> | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.priceCents) : "");
  const [categoryId, setCategoryId] = useState(initial?.category.id ?? "");
  const [stockQty, setStockQty] = useState(initial ? String(initial.stockQty) : "");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initial ? String(initial.lowStockThreshold) : "5",
  );
  const [internalPublished, setInternalPublished] = useState(initial?.isPublished ?? false);
  const [internalFeatured, setInternalFeatured] = useState(initial?.featured ?? false);
  const [imageUrls, setImageUrls] = useState<string[]>(
    initial?.imageUrls.length ? initial.imageUrls : [""],
  );

  const error = result && !result.ok ? result.error : null;
  const fieldErrors = getFieldErrors(error?.details);
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  // Publish/featured are controlled from the edit screen (sidebar quick
  // actions keep the checkbox in sync); create screen manages them locally.
  const effectiveIsPublished = isPublished ?? internalPublished;
  const effectiveFeatured = featured ?? internalFeatured;

  function handlePublishChange(value: boolean) {
    if (onIsPublishedChange) onIsPublishedChange(value);
    else setInternalPublished(value);
  }

  function handleFeaturedChange(value: boolean) {
    if (onFeaturedChange) onFeaturedChange(value);
    else setInternalFeatured(value);
  }

  function updateImage(index: number, value: string) {
    setImageUrls((prev) => prev.map((url, i) => (i === index ? value : url)));
  }

  function addImage() {
    setImageUrls((prev) => (prev.length < MAX_IMAGES ? [...prev, ""] : prev));
  }

  function removeImage(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const imageUrlsTrimmed = imageUrls.map((url) => url.trim()).filter(Boolean);

    startTransition(async () => {
      const res = initial
        ? await updateProductAction({
            productId: initial.id,
            name,
            slug,
            description: description || undefined,
            priceCents: Number(price),
            categoryId,
            stockQty: Number(stockQty),
            lowStockThreshold: Number(lowStockThreshold),
            isPublished: effectiveIsPublished,
            featured: effectiveFeatured,
            imageUrls: imageUrlsTrimmed,
          })
        : await createProductAction({
            name,
            slug,
            description: description || undefined,
            priceCents: Number(price),
            categoryId,
            stockQty: Number(stockQty),
            lowStockThreshold: Number(lowStockThreshold),
            isPublished: effectiveIsPublished,
            featured: effectiveFeatured,
            imageUrls: imageUrlsTrimmed,
          });

      if (res.ok) {
        if (initial) {
          setResult(res);
          router.refresh();
        } else {
          router.push("/admin/products");
          router.refresh();
        }
      } else {
        setResult(res);
      }
    });
  }

  const imageError = fieldErrors.imageUrls?.join(" ");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {pageError && (
        <Alert tone="danger" title={initial ? "Couldn't save changes" : "Couldn't create product"}>
          {pageError.message}
        </Alert>
      )}
      {result?.ok && initial && (
        <Alert tone="success" title="Product saved">
          Changes to {result.data.name} were saved.
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Name"
          required
          error={fieldErrors.name}
          hint="Shown on the storefront and in search."
          className="md:col-span-2"
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Claw Hammer 500g"
            required
            maxLength={160}
          />
        </FormField>

        <FormField
          label="Slug"
          required
          error={fieldErrors.slug}
          hint="Lowercase letters, digits and dashes — used in the storefront URL."
        >
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="e.g. claw-hammer-500g"
            required
            maxLength={160}
          />
        </FormField>

        <FormField label="Category" required error={fieldErrors.categoryId}>
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select a category…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Price (RWF)"
          required
          error={fieldErrors.priceCents}
          hint="Whole RWF amount, e.g. 65000."
        >
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="65000"
            required
          />
        </FormField>

        <FormField
          label="Initial stock"
          required
          error={fieldErrors.stockQty}
          hint={
            initial
              ? "Direct stock change is booked as an ADJUSTMENT ledger entry."
              : "Booked as a RESTOCK entry when the product is created."
          }
        >
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={stockQty}
            onChange={(event) => setStockQty(event.target.value)}
            placeholder="0"
            required
          />
        </FormField>

        <FormField
          label="Low-stock threshold"
          required
          error={fieldErrors.lowStockThreshold}
          hint="Stock at or below this is flagged as low on the storefront."
        >
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={lowStockThreshold}
            onChange={(event) => setLowStockThreshold(event.target.value)}
            placeholder="5"
            required
          />
        </FormField>

        <FormField
          label="Description"
          error={fieldErrors.description}
          hint="Optional. Benefits-led copy with specs — appears on the product page."
          className="md:col-span-2"
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Describe the tool, what it is used for and its key specs."
          />
        </FormField>
      </div>

      <fieldset className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <legend className="px-1 text-sm font-semibold text-ink">Images (MVP: URLs)</legend>
        <p className="text-xs text-stone-500">
          Seeded placeholder images live at /images/products/&lt;slug&gt;.svg. Image upload ships
          later — paste the public URL or a path under /images for now.
        </p>
        <div className="mt-3 space-y-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                value={url}
                onChange={(event) => updateImage(index, event.target.value)}
                placeholder={`Image URL ${index + 1}`}
                aria-label={`Image URL ${index + 1}`}
                maxLength={500}
              />
              {imageUrls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => removeImage(index)}
                >
                  <IconX className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {imageError && <p className="mt-2 text-sm text-danger-600">{imageError}</p>}
        {imageUrls.length < MAX_IMAGES && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addImage}>
            <IconPlus className="size-4" />
            Add image
          </Button>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <input
            type="checkbox"
            checked={effectiveIsPublished}
            onChange={(event) => handlePublishChange(event.target.checked)}
            className="size-4 accent-brand-700"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Published</span>
            <span className="block text-xs text-stone-500">
              Visible and buyable on the storefront.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <input
            type="checkbox"
            checked={effectiveFeatured}
            onChange={(event) => handleFeaturedChange(event.target.checked)}
            className="size-4 accent-brand-700"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Featured</span>
            <span className="block text-xs text-stone-500">
              Promoted on the homepage and catalog.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" href="/admin/products">
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {initial ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}