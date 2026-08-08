import { Skeleton } from "@/components/ui";

/** Route-level fallback for /admin/sales while the server page re-fetches. */
export default function SalesReportsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}