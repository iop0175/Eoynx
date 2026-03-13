import { SkeletonBox, FeedCardSkeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <SkeletonBox className="mb-1 h-7 w-24" />
      <SkeletonBox className="mb-6 h-4 w-48" />

      {/* Search bar */}
      <div className="mb-6 flex gap-2">
        <SkeletonBox className="h-10 flex-1 rounded-full" />
        <SkeletonBox className="h-10 w-16 rounded-full" />
      </div>

      {/* Results */}
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <FeedCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
