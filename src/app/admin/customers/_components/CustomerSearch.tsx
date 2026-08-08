"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterBar } from "@/components/admin";
import { Button, IconSearch, Input, Label } from "@/components/ui";

/**
 * Customer search toolbar (/admin/customers — customers-screen-agent).
 * URL-driven: submitting pushes `?q=`, the server page re-fetches and the
 * table remounts. `searching` just reflects the echo in the FilterBar.
 */
export function CustomerSearch({
  defaultValue,
  searching,
}: {
  defaultValue: string;
  searching: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    startTransition(() => {
      router.push(q ? `/admin/customers?q=${encodeURIComponent(q)}` : "/admin/customers");
    });
  }

  return (
    <FilterBar
      title="Filters"
      summary={searching ? `Searching “${defaultValue}”` : undefined}
      filters={
        <form role="search" className="flex w-full flex-wrap items-center gap-2" onSubmit={submit}>
          <Label htmlFor="customer-search" className="sr-only">
            Search customers
          </Label>
          <Input
            id="customer-search"
            type="search"
            placeholder="Search by name, email or phone"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="outline" size="md" loading={isPending}>
            <IconSearch className="size-4" />
            Search
          </Button>
        </form>
      }
      actions={
        searching ? (
          <Button href="/admin/customers" variant="ghost" size="sm">
            Clear search
          </Button>
        ) : undefined
      }
    />
  );
}