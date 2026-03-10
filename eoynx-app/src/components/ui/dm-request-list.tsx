import Link from "next/link";

export type DMRequestPreview = {
  id: string;
  name: string;
  message: string;
  time: string;
  mutuals?: number;
};

export function DMRequestList({ requests }: { requests: DMRequestPreview[] }) {
  return (
    <div className="grid gap-2">
      {requests.map((r) => (
        <Link
          key={r.id}
          href={`/dm/${r.id}`}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
        >
          <div className="flex items-center justify-between">
            <div className="font-medium">{r.name}</div>
            <div className="text-xs text-neutral-400">{r.time}</div>
          </div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{r.message}</div>
          {typeof r.mutuals === "number" ? (
            <div className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              {r.mutuals} mutuals
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
