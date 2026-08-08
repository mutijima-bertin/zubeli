"use client";

import { useRef, useState, useTransition, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createProductAction,
  updateProductAction,
} from "@/actions/admin/products";
import {
  Alert,
  Button,
  FormField,
  IconX,
  Input,
  Select,
  Spinner,
  Textarea,
  cx,
} from "@/components/ui";
import type { ActionResult, ProductDTO, UploadResult } from "@/types/api";

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

/** Decorative inline icon (same stroke style as the design-system set). */
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

/** POST /api/admin/upload — contract in src/types/api.ts (UploadResult). */
async function uploadImage(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/admin/upload", { method: "POST", body });
  return (await response.json()) as UploadResult;
}

function describeUploadError(error: Extract<UploadResult, { ok: false }>["error"]): string {
  switch (error.code) {
    case "UPLOAD_TOO_LARGE":
      return "That file is over 2 MB — the maximum is 2 MB per image.";
    case "UPLOAD_TYPE_REJECTED":
      return "Only JPG, PNG and WebP images are allowed.";
    case "UNAUTHORIZED":
      return "Your session expired — sign in again and retry the upload.";
    default:
      return error.message || "The upload failed — try again.";
  }
}

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
    initial?.imageUrls.filter((url) => url.trim().length > 0) ?? [],
  );

  // Image upload field state (POST /api/admin/upload).
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  function handleFilesChanged(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files);
  }

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  /** Uploads files one at a time; each success appends to imageUrls (max 8). */
  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploadError(null);

    const freeSlots = Math.max(0, MAX_IMAGES - imageUrls.length);
    if (freeSlots === 0) {
      setUploadError(`You can add up to ${MAX_IMAGES} images — remove one before adding more.`);
      return;
    }

    const accepted = files.slice(0, freeSlots);
    if (accepted.length < files.length) {
      setUploadError(
        `Only ${accepted.length} of ${files.length} added — you can keep up to ${MAX_IMAGES} images.`,
      );
    }

    for (const file of accepted) {
      setUploadingNames((prev) => [...prev, file.name]);
      try {
        const result = await uploadImage(file);
        if (result.ok) {
          setImageUrls((prev) => (prev.length < MAX_IMAGES ? [...prev, result.data.url] : prev));
        } else {
          setUploadError((prev) => prev ?? describeUploadError(result.error));
        }
      } catch {
        setUploadError((prev) => prev ?? "The upload failed — try again.");
      }
      setUploadingNames((prev) => prev.filter((name) => name !== file.name));
    }
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

  // Non-empty URLs with their original array index (removal must target the
  // same slot in imageUrls that the thumbnail represents).
  const previewUrls = imageUrls
    .map((url, index) => ({ url: url.trim(), index }))
    .filter((entry) => entry.url.length > 0);

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
        <legend className="px-1 text-sm font-semibold text-ink">Images</legend>
        <p className="text-xs text-stone-500">
          Photos are stored locally and served from /uploads. The first image is the cover on the
          catalog.
        </p>

        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFilesChanged}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label="Add product images"
            className={cx(
              "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              isDragging
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-stone-300 bg-stone-50 text-ink hover:border-brand-400 hover:bg-brand-50/60",
            )}
          >
            <UploadIcon className="size-7 text-stone-400" />
            <span className="mt-1 text-sm font-semibold">
              Drag &amp; drop photos here, or click to browse
            </span>
            <span className="text-xs text-stone-500">JPG, PNG or WebP · max 2 MB per file</span>
          </button>

          {uploadingNames.length > 0 && (
            <ul className="mt-3 space-y-1.5" aria-label="Uploads in progress">
              {uploadingNames.map((name, index) => (
                <li key={`${index}-${name}`} className="flex items-center gap-2 text-xs text-stone-600">
                  <Spinner size="sm" label={`Uploading ${name}`} />
                  <span className="min-w-0 truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}

          {uploadError && (
            <Alert tone="danger" title="Image upload failed" className="mt-3">
              {uploadError}
            </Alert>
          )}

          {previewUrls.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {previewUrls.map(({ url, index }) => (
                <li
                  key={`${index}-${url}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
                >
                  <Image
                    src={url}
                    alt={`Product image ${index + 1}`}
                    fill
                    sizes="(min-width: 40rem) 9rem, 33vw"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Remove image ${index + 1}`}
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition-colors hover:bg-white hover:text-danger-600"
                  >
                    <IconX className="size-4" />
                  </button>
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-stone-600">
                    {index + 1}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {imageError && <p className="mt-2 text-sm text-danger-600">{imageError}</p>}
        </div>
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