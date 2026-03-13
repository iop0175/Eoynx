/**
 * Reusable skeleton building blocks for loading states.
 */

export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

export function SkeletonCircle({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${
            i === lines - 1 ? "w-3/4" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

/** Feed card skeleton */
export function FeedCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      <div className="mb-3 flex items-center gap-3">
        <SkeletonCircle className="h-10 w-10" />
        <div className="flex-1">
          <SkeletonBox className="mb-1 h-3 w-24" />
          <SkeletonBox className="h-2.5 w-16" />
        </div>
      </div>
      <SkeletonBox className="aspect-[4/3] w-full rounded-xl" />
      <div className="mt-3">
        <SkeletonBox className="mb-2 h-4 w-3/4" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Profile item card skeleton (square image + info) */
export function ProfileItemSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black">
      <SkeletonBox className="aspect-square w-full rounded-t-2xl rounded-b-none" />
      <div className="p-3">
        <SkeletonBox className="mb-1.5 h-3.5 w-3/4" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** DM thread row skeleton */
export function DMThreadSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      <SkeletonCircle className="h-12 w-12 shrink-0" />
      <div className="flex-1">
        <SkeletonBox className="mb-2 h-3.5 w-28" />
        <SkeletonBox className="h-3 w-48" />
      </div>
      <SkeletonBox className="h-3 w-10" />
    </div>
  );
}

/** Notification row skeleton */
export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      <SkeletonCircle className="h-10 w-10 shrink-0" />
      <div className="flex-1">
        <SkeletonBox className="mb-2 h-3 w-48" />
        <SkeletonBox className="h-2.5 w-20" />
      </div>
      <SkeletonBox className="h-12 w-12 shrink-0 rounded-lg" />
    </div>
  );
}

/** Category pill tabs skeleton */
export function PillTabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} className="h-8 w-20 rounded-full" />
      ))}
    </div>
  );
}
