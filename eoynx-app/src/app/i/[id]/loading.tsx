import { SkeletonBox, SkeletonText } from "@/components/ui/skeleton";

export default function ItemLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <SkeletonBox className="mb-1 h-7 w-48" />
      <SkeletonBox className="mb-6 h-4 w-64" />

      {/* Content card */}
      <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="grid gap-4">
          {/* Image slider */}
          <SkeletonBox className="h-72 w-full rounded-xl" />

          {/* Details card */}
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <SkeletonBox className="mb-1 h-3 w-12" />
                <SkeletonBox className="h-4 w-16" />
              </div>
              <div>
                <SkeletonBox className="mb-1 h-3 w-12" />
                <SkeletonBox className="h-4 w-20" />
              </div>
              <div>
                <SkeletonBox className="mb-1 h-3 w-12" />
                <SkeletonBox className="h-4 w-24" />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBox key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>

          {/* Owner card */}
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <SkeletonText lines={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
