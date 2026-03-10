import Link from "next/link";
import { VisibilityBadge } from "@/components/ui/visibility-badge";

export function ItemCard({
  id,
  title,
  visibility,
  imageUrl,
  right,
}: {
  id: string;
  title: string;
  visibility: "public" | "unlisted" | "private";
  imageUrl?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <Link
      href={`/i/${id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <div className="mt-1">
            <VisibilityBadge visibility={visibility} />
          </div>
        </div>
      </div>

      {right}
    </Link>
  );
}
