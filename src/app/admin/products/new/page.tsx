import type { Metadata } from "next";
import { listAll } from "@/lib/db/categories";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { ProductForm } from "../_components/ProductForm";

export const metadata: Metadata = {
  title: "New product | Admin — Zubeli",
};

/**
 * Create product — /admin/products/new (Inventory).
 * Server shell: fetches categories for the select and renders the shared
 * ProductForm in create mode. The action re-checks admin auth, and the
 * admin layout already guards the route.
 */
export default async function NewProductPage() {
  const categories = await listAll();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">New product</h1>
        <p className="mt-1 text-sm text-stone-600">
          Add a product to the catalog. Initial stock is booked as a RESTOCK entry.
        </p>
      </div>

      <Card>
        <CardHeader title="Product details" description="Fields marked * are required." />
        <CardBody>
          <ProductForm
            categories={categories.map((category) => ({
              id: category.id,
              slug: category.slug,
              name: category.name,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}