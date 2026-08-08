"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProductAction, togglePublishAction } from "@/actions/admin/products";
import { Alert, Badge, Button, Dialog, IconTrash } from "@/components/ui";
import type { ProductDTO } from "@/types/api";
import { ProductForm, type CategoryOption } from "../../../_components/ProductForm";

/**
 * Edit product screen — /admin/products/[id]/edit (Inventory).
 * Client wrapper: holds the live product (refresh after quick actions),
 * renders the shared ProductForm in controlled-publish mode, plus a sidebar
 * with publish/unpublish and delete quick actions. Delete is a soft delete
 * (order history stays intact) and bounces back to the product list.
 */
export function EditProductClient({
  product,
  categories,
}: {
  product: ProductDTO;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(product);
  const [busyAction, setBusyAction] = useState<"publish" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePublish() {
    if (busyAction) return;
    setBusyAction("publish");
    setError(null);
    startTransition(async () => {
      const result = await togglePublishAction({ productId: current.id });
      setBusyAction(null);
      if (result.ok) {
        setCurrent(result.data);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  function handleDelete() {
    if (busyAction) return;
    setBusyAction("delete");
    setError(null);
    startTransition(async () => {
      const result = await deleteProductAction({ productId: current.id });
      setBusyAction(null);
      setConfirmDelete(false);
      if (result.ok) {
        router.push("/admin/products");
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  const isPendingAction = busyAction !== null || isPending;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        {error && (
          <Alert tone="danger" title="Action failed" className="mb-4">
            {error}
          </Alert>
        )}
        <ProductForm
          categories={categories}
          initial={current}
          isPublished={current.isPublished}
          onIsPublishedChange={(value) => setCurrent((prev) => ({ ...prev, isPublished: value }))}
          featured={current.featured}
          onFeaturedChange={(value) => setCurrent((prev) => ({ ...prev, featured: value }))}
        />
      </div>

      <aside className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Quick actions
        </h2>
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Store visibility</p>
          <Badge tone={current.isPublished ? "success" : "neutral"}>
            {current.isPublished ? "Published" : "Unpublished"}
          </Badge>
          <p className="mt-2 text-xs text-stone-500">
            {current.isPublished
              ? "This product is visible and buyable on the storefront."
              : "Hidden from customers until you publish it."}
          </p>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            loading={busyAction === "publish"}
            onClick={togglePublish}
            disabled={isPendingAction && busyAction !== "publish"}
          >
            {current.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>

        <hr className="my-4 border-stone-100" />

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Danger zone</p>
          <p className="text-xs text-stone-500">
            Soft delete — hidden from the storefront and the admin list; order history stays
            intact.
          </p>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            className="text-danger-600 hover:bg-danger-50"
            onClick={() => setConfirmDelete(true)}
          >
            <IconTrash className="size-4" />
            Delete product
          </Button>
        </div>
      </aside>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete product"
        side="center"
      >
        <div className="px-5 py-4">
          <p className="text-sm text-stone-600">
            Delete <span className="font-semibold text-ink">{current.name}</span>? It will be
            hidden from the storefront and the admin list. Existing orders keep their history.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busyAction === "delete"} onClick={handleDelete}>
              Delete product
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}