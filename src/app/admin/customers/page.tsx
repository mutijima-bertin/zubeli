import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listCustomersAdminAction } from "@/actions/admin/customers";
import { Alert, Button, EmptyState } from "@/components/ui";
import { CustomerSearch } from "./_components/CustomerSearch";
import { CustomersTable } from "./_components/CustomersTable";

export const metadata: Metadata = {
  title: "Customers | Admin | Zubeli",
  description:
    "Every Zubeli shopper — registered customers and guest checkouts with contact details and lifetime order totals.",
};

const PAGE_SIZE = 25;

type CustomersSearchParams = { q?: string | string[] };

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Admin customers list — /admin/customers (Milestone 5, customers-screen-agent).
 * Server shell: one listCustomersAdminAction pass for page 1, then the client
 * CustomersTable appends pages via the returned cursor. Search lives in the URL
 * (`?q=`) — CustomerSearch pushes it, this page re-fetches and remounts the
 * table via `key` so state never carries stale rows across searches.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  const params = await searchParams;
  const raw = firstParam(params.q);
  const search = typeof raw === "string" ? raw.trim() : undefined;
  const q = search || undefined;

  const result = await listCustomersAdminAction({ search: q, limit: PAGE_SIZE });

  if (!result.ok) {
    if (result.error.code === "NOT_AUTHORIZED") redirect("/");
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Customers</h1>
          <p className="mt-1 text-sm text-stone-600">
            Registered customers and guest checkouts — contact details and lifetime order totals.
          </p>
        </div>
        <Alert tone="danger" title="Couldn't load customers">
          {result.error.message}
        </Alert>
        <Button href="/admin/customers" variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  const { items, nextCursor, hasMore } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Customers</h1>
        <p className="mt-1 text-sm text-stone-600">
          Registered customers and guest checkouts — contact details and lifetime order totals.
        </p>
      </div>

      <CustomerSearch defaultValue={q ?? ""} searching={Boolean(q)} />

      {items.length === 0 ? (
        q ? (
          <EmptyState
            title="No customers match your search"
            description={`We couldn't find any customers matching “${q}”. Check the spelling or clear the search.`}
            action={
              <Button href="/admin/customers" variant="outline">
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No customers yet"
            description="When orders are placed with contact details, customers appear here."
            action={
              <Button href="/admin/orders" variant="outline">
                View orders
              </Button>
            }
          />
        )
      ) : (
        <CustomersTable
          key={q ?? ""}
          search={q}
          initialItems={items}
          initialNextCursor={nextCursor}
          initialHasMore={hasMore}
        />
      )}
    </div>
  );
}