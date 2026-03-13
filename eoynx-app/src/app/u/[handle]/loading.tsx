import {
  SkeletonBox,
  SkeletonCircle,
  PillTabsSkeleton,
  ProfileItemSkeleton,
} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Profile header card */}
      <div className="mb-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start gap-4">
          <SkeletonCircle className="h-16 w-16 shrink-0" />
          <div className="flex-1">
            <SkeletonBox className="mb-2 h-5 w-32" />
            <SkeletonBox className="mb-3 h-3.5 w-24" />
            <div className="flex gap-4">
              <SkeletonBox className="h-3 w-20" />
              <SkeletonBox className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* Rank block */}
        <SkeletonBox className="mt-6 h-20 w-full rounded-xl" />

        {/* Category tabs */}
        <div className="mt-4">
          <PillTabsSkeleton count={4} />
        </div>
      </div>

      {/* Sort controls */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-4 w-16" />
        <SkeletonBox className="h-8 w-24 rounded-lg" />
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProfileItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
