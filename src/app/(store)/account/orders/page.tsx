import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyOrdersAction } from "@/actions/account";
import { getSession } from "@/lib/auth/session";
import { Alert, Button, EmptyState } from "@/components/ui";
import { OrderHistoryTable } from "./_components/OrderHistoryTable";

export const metadata: Metadata = {
  title: "Order history | Zubeli",
  description:
    "Review every order you've placed with Zubeli — status, items, totals and payment details.",
};

const PAGE_SIZE = 10;

/**
 * Order history (Phase C-5 — account-agent). Server shell: fetches the
 * first page via getMyOrdersAction, then hands serializable props to the
 * client OrderHistoryTable which load-more appends pages with the cursor.
 * Empty and error states render here (server-side); the client table only
 * ever appends rows.
 */
export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/orders");

  const result = await getMyOrdersAction({ limit: PAGE_SIZE });

  if (!result.ok) {
    if (result.error.code === "NOT_AUTHORIZED") redirect("/login?next=/account/orders");
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Order history</h1>
        <p className="mt-1 text-sm text-stone-600">All the orders you have placed with Zubeli.</p>
        <div className="mt-8 space-y-4">
          <Alert tone="danger" title="Couldn't load your orders">
            {result.error.message}
          </Alert>
          <Button href="/account/orders" variant="outline">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const { items, nextCursor, hasMore } = result.data;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Order history</h1>
      <p className="mt-1 text-sm text-stone-600">All the orders you have placed with Zubeli.</p>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            description="When you place an order it will show up here with its status, items and payment details."
            action={<Button href="/products">Browse construction tools</Button>}
          />
        </div>
      ) : (
        <div className="mt-8">
          <OrderHistoryTable
            initialItems={items}
            initialNextCursor={nextCursor}
            initialHasMore={hasMore}
          />
        </div>
      )}
    </div>
  );
}
