import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryById } from "@/lib/db/categories";
import { Alert, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { CategoryForm } from "../../_components/CategoryForm";

export const metadata: Metadata = {
  title: "Edit category | Admin — Zubeli",
};

/**
 * Edit category — /admin/categories/[id]/edit (Inventory).
 * Server shell: reads getCategoryById(); unknown id → notFound() (404),
 * read failure → inline error with a way back. The update action re-checks
 * admin auth; the admin layout guards the route.
 */
export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let category;
  try {
    category = await getCategoryById(id);
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Edit category</h1>
        <Alert tone="danger" title="Couldn't load this category">
          Something went wrong while reading the catalog. Refresh the page and try again.
        </Alert>
        <Button href="/admin/categories" variant="outline">
          Back to categories
        </Button>
      </div>
    );
  }

  if (!category) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Edit: {category.name}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {category.productCount}{" "}
            {category.productCount === 1 ? "product uses" : "products use"} this category.
          </p>
        </div>
        <Button href="/admin/categories" variant="outline">
          Back to categories
        </Button>
      </div>

      <Card>
        <CardHeader title="Category details" description="Fields marked * are required." />
        <CardBody>
          <CategoryForm initial={category} />
        </CardBody>
      </Card>
    </div>
  );
}
