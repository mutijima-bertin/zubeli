import type { Metadata } from "next";
import { listCategoriesForAdmin } from "@/lib/db/categories";
import { Alert, Button, EmptyState, IconPlus } from "@/components/ui";
import { IconFolder } from "@/components/admin";
import { CategoriesManager } from "./_components/CategoriesManager";

export const metadata: Metadata = {
  title: "Categories | Admin — Zubeli",
};

/**
 * Category list — /admin/categories (Inventory).
 * Server shell: reads listCategoriesForAdmin() directly (the contract has no
 * list server action) and delegates search + row actions to CategoriesManager.
 * Every mutation action re-checks admin auth; the admin layout guards the route.
 */
export default async function AdminCategoriesPage() {
  let categories: Awaited<ReturnType<typeof listCategoriesForAdmin>>;
  try {
    categories = await listCategoriesForAdmin();
  } catch {
    return (
      <div className="space-y-6">
        <CategoryPageHeader />
        <Alert tone="danger" title="Couldn't load categories">
          Something went wrong while reading the catalog. Refresh the page and try again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CategoryPageHeader />

      {categories.length === 0 ? (
        <EmptyState
          icon={<IconFolder className="size-6" />}
          title="No categories yet"
          description="Create a category to group products in the storefront navigation and filters."
          action={
            <Button href="/admin/categories/new" variant="primary">
              <IconPlus className="size-4" />
              New category
            </Button>
          }
        />
      ) : (
        <CategoriesManager initial={categories} />
      )}
    </div>
  );
}

function CategoryPageHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Categories</h1>
        <p className="mt-1 text-sm text-stone-600">
          Group the catalog into storefront sections. Deactivating a category hides only the
          category — its products stay published and sellable.
        </p>
      </div>
      <Button href="/admin/categories/new">
        <IconPlus className="size-4" />
        New category
      </Button>
    </div>
  );
}
