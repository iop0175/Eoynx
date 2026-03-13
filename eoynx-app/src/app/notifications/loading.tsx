import { SkeletonBox, NotificationSkeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <SkeletonBox className="mb-1 h-7 w-20" />
      <SkeletonBox className="mb-6 h-4 w-36" />

      {/* Notification list */}
      <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
