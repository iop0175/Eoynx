import { SkeletonBox, DMThreadSkeleton } from "@/components/ui/skeleton";

export default function DMLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <SkeletonBox className="mb-1 h-6 w-32" />
          <SkeletonBox className="h-3.5 w-44" />
        </div>
        <SkeletonBox className="h-9 w-24 rounded-full" />
      </div>

      {/* Thread list */}
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <DMThreadSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
