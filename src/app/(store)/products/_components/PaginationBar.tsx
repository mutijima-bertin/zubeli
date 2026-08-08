"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginationLoadMore } from "@/components/ui";

/**
 * Load-more bar — client. Appends the server-provided `cursor` to the URL
 * (preserving `q`/`cat`/`sort`) via router.push inside a transition; the page
 * re-renders server-side with the next page and ProductGrid accumulates it.
 * Shared PaginationLoadMore owns the button, pending spinner and end-of-list
 * notice.
 */
export function PaginationBar({
  hasMore,
  nextCursor,
}: {
  hasMore: boolean;
  nextCursor: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (!nextCursor || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("cursor", nextCursor);
    startTransition(() => {
      router.push(`/products?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <PaginationLoadMore
      hasMore={hasMore}
      loading={isPending}
      onLoadMore={loadMore}
      label="Load more tools"
      endLabel="You have seen everything"
    />
  );
}
