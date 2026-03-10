import Link from "next/link";

export function UserHeader({
  handle,
  displayName,
  subtitle,
  right,
}: {
  handle: string;
  displayName?: string | null;
  subtitle?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-white">
            {displayName ?? `@${handle}`}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">@{handle}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{subtitle}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {right}
        <Link
          href={`/u/${handle}`}
          className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
        >
          View
        </Link>
      </div>
    </div>
  );
}
