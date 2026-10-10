import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { CategoryForm } from "../_components/CategoryForm";

export const metadata: Metadata = {
  title: "New category | Admin — Zubeli",
};

/**
 * Create category — /admin/categories/new (Inventory).
 * Server shell only: the action re-checks admin auth and the admin layout
 * guards the route, so no extra guard is needed here.
 */
export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">New category</h1>
        <p className="mt-1 text-sm text-stone-600">
          Add a storefront section. Products can be moved into it from any product form.
        </p>
      </div>

      <Card>
        <CardHeader title="Category details" description="Fields marked * are required." />
        <CardBody>
          <CategoryForm />
        </CardBody>
      </Card>
    </div>
  );
}
