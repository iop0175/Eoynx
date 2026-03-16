"use client";

/**
 * 피드 카드 스켈레톤 UI
 * 피드 로딩 중 표시되는 플레이스홀더
 */
export function FeedCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      {/* Header - Avatar + User Info */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex-1">
          <div className="mb-1 h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>

      {/* Image placeholder */}
      <div className="mb-3 aspect-[4/3] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />

      {/* Title */}
      <div className="mb-2 h-5 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
      
      {/* Description */}
      <div className="mb-4 space-y-2">
        <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <div className="h-8 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-8 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-8 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

/**
 * 피드 스켈레톤 리스트
 */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}
