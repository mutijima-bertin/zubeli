"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  deleteProductAction,
  listProductsAdminAction,
  togglePublishAction,
} from "@/actions/admin/products";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  IconBox,
  IconPlus,
  IconSearch,
  IconTrash,
  Input,
  Select,
} from "@/components/ui";
import { DataTable, FilterBar, type DataTableColumn } from "@/components/admin";
import { formatRWF } from "@/lib/format";
import type { Page, ProductDTO } from "@/types/api";

export type CategoryOption = { id: string; slug: string; name: string };

type StatusFilter = "all" | "published" | "unpublished";

/**
 * Product list manager — /admin/products (Inventory milestone).
 * Owns: client-side filters (search debounced + category select), cursor
 * pagination via the DataTable widget, and per-row actions (publish toggle,
 * soft delete behind a confirm Dialog). The list action has no isPublished
 * param, so the status filter narrows the already-loaded rows client-side.
 * Feedback uses Alert (the admin shell has no ToastProvider yet).
 */
export function ProductManager({
  initial,
  categories,
}: {
  initial: Page<ProductDTO>;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ProductDTO[]>(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());
  const [categorySlug, setCategorySlug] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductDTO | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  const visibleItems = useMemo(() => {
    if (status === "all") return items;
    return items.filter((item) => (status === "published" ? item.isPublished : !item.isPublished));
  }, [items, status]);

  const fetchPage = useCallback(
    async (params: { search?: string; categorySlug?: string; cursor?: string }, append: boolean) => {
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      const result = await listProductsAdminAction({
        search: params.search || undefined,
        categorySlug: params.categorySlug || undefined,
        cursor: params.cursor,
        limit: 25,
      });
      if (seq !== requestSeq.current) return; // superseded by a newer request
      setLoading(false);
      setLoadingMore(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setItems((prev) => (append ? [...prev, ...result.data.items] : result.data.items));
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    },
    [],
  );

  // The server page already fetched the first (unfiltered) page — skip the
  // initial effect run; later filter changes re-fetch.
  const skippedInitialFetch = useRef(false);
  useEffect(() => {
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      return;
    }
    void fetchPage({ search: deferredSearch || undefined, categorySlug: categorySlug || undefined }, false);
  }, [deferredSearch, categorySlug, fetchPage]);

  async function togglePublish(product: ProductDTO) {
    setBusyId(product.id);
    const result = await togglePublishAction({ productId: product.id });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === product.id ? result.data : item)));
    showNotice(result.data.isPublished ? "Product published" : "Product unpublished");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    const result = await deleteProductAction({ productId: target.id });
    setBusyId(null);
    setDeleteTarget(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== target.id));
    showNotice("Product deleted");
    router.refresh();
  }

  const columns: DataTableColumn<ProductDTO>[] = [
    {
      key: "product",
      header: "Product",
      render: (product) => (
        <span className="flex items-center gap-3">
          <span className="relative block size-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
            {product.imageUrls[0] ? (
              <Image src={product.imageUrls[0]} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <IconBox className="absolute inset-0 m-auto size-5 text-stone-300" />
            )}
          </span>
          <span className="min-w-0">
            <Link
              href={`/admin/products/${product.id}/edit`}
              className="block truncate font-semibold text-ink transition-colors hover:text-brand-700"
            >
              {product.name}
            </Link>
            <span className="block truncate text-xs text-stone-500">/{product.slug}</span>
          </span>
        </span>
      ),
    },
    { key: "category", header: "Category", render: (product) => product.category.name },
    {
      key: "price",
      header: "Price",
      className: "text-right",
      render: (product) => formatRWF(product.priceCents, product.currency),
    },
    {
      key: "stock",
      header: "Stock",
      className: "text-right",
      render: (product) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          {product.stockQty}
          {product.stockQty <= 0 ? (
            <Badge tone="danger">Out</Badge>
          ) : product.stockQty <= product.lowStockThreshold ? (
            <Badge tone="warning">Low</Badge>
          ) : (
            <Badge tone="success">OK</Badge>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (product) => (
        <span className="inline-flex flex-wrap gap-1">
          <Badge tone={product.isPublished ? "success" : "neutral"}>
            {product.isPublished ? "Published" : "Unpublished"}
          </Badge>
          {product.featured && <Badge tone="brand">Featured</Badge>}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      render: (product) => (
        <span className="inline-flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={busyId === product.id}
            onClick={() => void togglePublish(product)}
          >
            {product.isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${product.name}`}
            onClick={() => setDeleteTarget(product)}
            className="text-danger-600 hover:bg-danger-50"
          >
            <IconTrash className="size-4" />
          </Button>
        </span>
      ),
    },
  ];

  const filterControls = (
    <>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search name or slug"
          aria-label="Search products"
          className="h-10 w-56 pl-9"
        />
      </div>
      <Select
        value={categorySlug}
        onChange={(event) => setCategorySlug(event.target.value)}
        aria-label="Filter by category"
        className="w-48"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </Select>
      <Select
        value={status}
        onChange={(event) => setStatus(event.target.value as StatusFilter)}
        aria-label="Filter by status"
        className="w-44"
      >
        <option value="all">All statuses</option>
        <option value="published">Published</option>
        <option value="unpublished">Unpublished</option>
      </Select>
    </>
  );

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && (
        <Alert tone="danger" title="Couldn't load products">
          {error}
        </Alert>
      )}

      <FilterBar
        title="Filters"
        filters={filterControls}
        summary={`${visibleItems.length} of ${items.length} shown`}
        actions={
          <Button href="/admin/products/new" size="sm">
            <IconPlus className="size-4" />
            New product
          </Button>
        }
      />

      <DataTable<ProductDTO>
        columns={columns}
        data={visibleItems}
        rowKey={(product) => product.id}
        ariaLabel="Products"
        loading={loading}
        skeletonRows={5}
        emptyTitle="No products found"
        emptyDescription={
          searchInput || categorySlug
            ? "Try adjusting your search or filters."
            : "Create your first product to start selling online."
        }
        emptyAction={
          !searchInput && !categorySlug ? (
            <Button href="/admin/products/new" size="sm">
              <IconPlus className="size-4" />
              New product
            </Button>
          ) : undefined
        }
        hasMore={hasMore}
        onLoadMore={() =>
          void fetchPage(
            {
              search: deferredSearch || undefined,
              categorySlug: categorySlug || undefined,
              cursor: nextCursor ?? undefined,
            },
            true,
          )
        }
        loadingMore={loadingMore}
        loadMoreLabel="Load more products"
      />

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete product"
        side="center"
      >
        {deleteTarget && (
          <div className="px-5 py-4">
            <p className="text-sm text-stone-600">
              Delete <span className="font-semibold text-ink">{deleteTarget.name}</span>? It will be
              hidden from the storefront and the admin list. Existing orders keep their history.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busyId === deleteTarget.id} onClick={() => void confirmDelete()}>
                Delete product
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}