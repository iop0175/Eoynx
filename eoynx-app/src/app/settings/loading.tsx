import { SkeletonBox } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <SkeletonBox className="mb-1 h-7 w-16" />
      <SkeletonBox className="mb-6 h-4 w-32" />

      {/* Content card */}
      <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="grid gap-4">
          {/* Section cards */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <SkeletonBox className="mb-3 h-4 w-24" />
              <SkeletonBox className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
