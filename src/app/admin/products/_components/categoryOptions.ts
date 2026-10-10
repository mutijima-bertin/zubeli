import type { listCategoriesForAdmin } from "@/lib/db/categories";

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  /** From listCategoriesForAdmin — inactive rows render as "Name (inactive)". */
  isActive: boolean;
};

export function toCategoryOptions(
  categories: Awaited<ReturnType<typeof listCategoriesForAdmin>>
): CategoryOption[] {
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    isActive: category.isActive,
  }));
}
