import type { Metadata } from "next";
import { listAll } from "@/lib/db/categories";
import { listProductsAdminAction } from "@/actions/admin/products";
import { Alert, Button, EmptyState, IconPlus, IconShieldCheck } from "@/components/ui";
import {
  ProductManager,
  type CategoryOption,
} from "./_components/ProductManager";

export const metadata: Metadata = {
  title: "Products | Admin — Zubeli",
};

/**
 * Product list — /admin/products (Inventory).
 * Server shell: fetches the first page + categories, delegates all
 * interactivity (filters, pagination, publish, delete) to the ProductManager
 * client component. Every server action call inside re-checks admin auth
 * (requireAdminOrThrow), so the page needs no extra guard.
 */
export default async function AdminProductsPage() {
  const [pageResult, categoryRows] = await Promise.all([
    listProductsAdminAction({ limit: 25 }),
    listAll(),
  ]);

  const categories: CategoryOption[] = categoryRows.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Products</h1>
          <p className="mt-1 text-sm text-stone-600">
            Create, edit, publish and delete the catalog sold on the storefront.
          </p>
        </div>
        <Button href="/admin/products/new">
          <IconPlus className="size-4" />
          New product
        </Button>
      </div>

      {!pageResult.ok ? (
        <Alert tone="danger" title="Couldn't load products">
          {pageResult.error.message}
        </Alert>
      ) : pageResult.data.items.length === 0 && categories.length === 0 ? (
        <EmptyState
          icon={<IconShieldCheck className="size-6" />}
          title="No products yet"
          description="Create your first product to start selling online."
          action={
            <Button href="/admin/products/new" variant="primary">
              <IconPlus className="size-4" />
              New product
            </Button>
          }
        />
      ) : (
        <ProductManager initial={pageResult.data} categories={categories} />
      )}
    </div>
  );
}