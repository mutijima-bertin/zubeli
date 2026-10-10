import type { Metadata } from "next";
import { listCategoriesForAdmin } from "@/lib/db/categories";
import { listProductsAdminAction } from "@/actions/admin/products";
import { Alert, Button, EmptyState, IconPlus, IconShieldCheck } from "@/components/ui";
import { ProductManager } from "./_components/ProductManager";
import { toCategoryOptions } from "./_components/categoryOptions";

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
  // listCategoriesForAdmin (not listAll) so a product whose category was just
  // deactivated still shows its selected option — inactive rows are labelled
  // "(inactive)" in the selects (defect fix from backend-agent).
  const [pageResult, categoryRows] = await Promise.all([
    listProductsAdminAction({ limit: 25 }),
    listCategoriesForAdmin(),
  ]);

  const categories = toCategoryOptions(categoryRows);

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