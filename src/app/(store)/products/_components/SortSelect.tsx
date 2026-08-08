"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label, Select } from "@/components/ui";
import type { ProductSort } from "@/lib/db/products";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "featured", label: "Featured first" },
];

/**
 * Sort control — client. Pushes `sort` onto the URL (single source of truth)
 * and resets `cursor` (pagination contract); the page re-renders server-side,
 * so there is no local result state and no page reload.
 */
export function SortSelect({ value }: { value: ProductSort }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ProductSort;
    if (next === value || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    params.delete("cursor"); // sort changes reset pagination
    startTransition(() => {
      router.push(`/products?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
      <Label htmlFor="catalog-sort" className="sr-only">
        Sort products
      </Label>
      <div className="w-full sm:w-56">
        <Select
          id="catalog-sort"
          value={value}
          onChange={handleChange}
          disabled={isPending}
          aria-busy={isPending || undefined}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
