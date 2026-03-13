import {
  FeedCardSkeleton,
  PillTabsSkeleton,
} from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-4">
        <PillTabsSkeleton count={5} />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <FeedCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
