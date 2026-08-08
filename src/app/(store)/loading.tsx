import { Skeleton } from "@/components/ui";

/**
 * Route-level loading fallback for the storefront shell (Suspense boundary).
 * Generic card grid — screen agents may override with their own loading.tsx
 * under their routes.
 */
export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}