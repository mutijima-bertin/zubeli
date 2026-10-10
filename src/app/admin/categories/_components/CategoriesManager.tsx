"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteCategory, toggleCategoryActive } from "@/actions/admin/categories";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  IconPlus,
  IconSearch,
  IconTrash,
  Input,
  useToast,
} from "@/components/ui";
import { DataTable, FilterBar, type DataTableColumn } from "@/components/admin";
import { formatDate } from "@/lib/format";
import type { AdminCategory } from "@/lib/db/categories";

/** `error.details.productCount` on the blocked-delete refusal (VALIDATION). */
function productCountOf(details: unknown): number | null {
  if (!details || typeof details !== "object") return null;
  const count = (details as { productCount?: unknown }).productCount;
  return typeof count === "number" ? count : null;
}

/**
 * Category list manager — /admin/categories.
 * Owns: client-side name/slug search, per-row actions (Activate/Deactivate
 * behind a confirm dialog, Delete behind a confirm dialog), and the two
 * behaviour-specific failure surfaces:
 * - Delete blocked (products reference the category): the dialog STAYS OPEN
 *   with the server's count message + a reassign/deactivate hint.
 * - Deactivate: confirm copy states the category is hidden while its products
 *   stay published and sellable.
 * productCount comes straight from listCategoriesForAdmin — never recomputed.
 */
export function CategoriesManager({ initial }: { initial: AdminCategory[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<AdminCategory[]>(initial);
  const [searchInput, setSearchInput] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminCategory | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = searchInput.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!query) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query),
    );
  }, [items, query]);

  async function runToggle(category: AdminCategory) {
    setBusyId(category.id);
    setError(null);
    const result = await toggleCategoryActive(category.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === category.id ? result.data : item)));
    toast(
      result.data.isActive
        ? { title: "Category activated", message: `“${result.data.name}” is visible on the storefront again.`, tone: "success" }
        : {
            title: "Category deactivated",
            message: `“${result.data.name}” is hidden from the storefront — its products stay published and sellable.`,
            tone: "info",
          },
    );
    router.refresh();
  }

  function requestToggle(category: AdminCategory) {
    if (category.isActive) {
      // Deactivating hides the category — confirm the impact first.
      setDeactivateTarget(category);
    } else {
      void runToggle(category);
    }
  }

  function confirmDeactivate() {
    const target = deactivateTarget;
    if (!target) return;
    setDeactivateTarget(null);
    void runToggle(target);
  }

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      setError(null);
      setDeleteError(null);
      const result = await deleteCategory(target.id);
      if (!result.ok) {
        const count = productCountOf(result.error.details);
        const hint =
          count !== null
            ? "Move those products to another category first (edit each product), or deactivate this category instead — deactivating keeps the products published."
            : null;
        setDeleteError(
          hint ? `${result.error.message} ${hint}` : result.error.message,
        );
        return;
      }
      setDeleteTarget(null);
      setItems((prev) => prev.filter((item) => item.id !== target.id));
      toast({ title: "Category deleted", message: `“${target.name}” was removed.`, tone: "success" });
      router.refresh();
    });
  }

  const columns: DataTableColumn<AdminCategory>[] = [
    {
      key: "name",
      header: "Category",
      render: (category) => (
        <span className="min-w-0">
          <Link
            href={`/admin/categories/${category.id}/edit`}
            className="block truncate font-semibold text-ink transition-colors hover:text-brand-700"
          >
            {category.name}
          </Link>
          <span className="block truncate text-xs text-stone-500">/{category.slug}</span>
        </span>
      ),
    },
    {
      key: "productCount",
      header: "Products",
      className: "text-right",
      render: (category) => category.productCount,
    },
    {
      key: "isActive",
      header: "Status",
      render: (category) => (
        <Badge tone={category.isActive ? "success" : "neutral"}>
          {category.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (category) => (
        <span className="text-sm text-stone-600">{formatDate(category.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      render: (category) => (
        <span className="inline-flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            href={`/admin/categories/${category.id}/edit`}
            aria-label={`Edit ${category.name}`}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`${category.isActive ? "Deactivate" : "Activate"} ${category.name}`}
            loading={busyId === category.id}
            onClick={() => requestToggle(category)}
          >
            {category.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${category.name}`}
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(category);
            }}
            className="text-danger-600 hover:bg-danger-50"
          >
            <IconTrash className="size-4" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <Alert tone="danger" title="Action failed">
          {error}
        </Alert>
      )}

      <FilterBar
        title="Filters"
        filters={
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name or slug"
              aria-label="Search categories"
              className="h-10 w-56 pl-9"
            />
          </div>
        }
        summary={`${visibleItems.length} of ${items.length} shown`}
        actions={
          <Button href="/admin/categories/new" size="sm">
            <IconPlus className="size-4" />
            New category
          </Button>
        }
      />

      <DataTable<AdminCategory>
        columns={columns}
        data={visibleItems}
        rowKey={(category) => category.id}
        ariaLabel="Categories"
        emptyTitle="No categories found"
        emptyDescription={
          query ? "Try adjusting your search." : "Create your first category to group products."
        }
        emptyAction={
          !query ? (
            <Button href="/admin/categories/new" size="sm">
              <IconPlus className="size-4" />
              New category
            </Button>
          ) : undefined
        }
      />

      {/* Deactivate — impact must be unambiguous before confirming. */}
      <Dialog
        open={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate category"
        side="center"
      >
        {deactivateTarget && (
          <div className="px-5 py-4">
            <p className="text-sm text-stone-600">
              Deactivate{" "}
              <span className="font-semibold text-ink">{deactivateTarget.name}</span>? It disappears
              from the storefront navigation, the homepage showcase and the catalog filters —{" "}
              <span className="font-semibold text-ink">
                its {deactivateTarget.productCount}{" "}
                {deactivateTarget.productCount === 1 ? "product stays" : "products stay"} published
                and sellable
              </span>
              . Reactivate it at any time.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={busyId === deactivateTarget.id}
                onClick={confirmDeactivate}
              >
                Deactivate category
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete — stays open with the server's blocked-delete message. */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        title="Delete category"
        side="center"
      >
        {deleteTarget && (
          <div className="px-5 py-4">
            <p className="text-sm text-stone-600">
              Delete <span className="font-semibold text-ink">{deleteTarget.name}</span> permanently?
              Products that use it must be reassigned first.
            </p>
            {deleteError && (
              <Alert tone="danger" title="Can't delete this category" className="mt-3">
                {deleteError}
              </Alert>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
              >
                {deleteError ? "Close" : "Cancel"}
              </Button>
              <Button variant="danger" loading={isPending} onClick={confirmDelete}>
                Delete category
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
