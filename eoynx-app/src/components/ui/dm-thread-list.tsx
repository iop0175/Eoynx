import Link from "next/link";

export type DMThreadPreview = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread?: boolean;
};

export function DMThreadList({
  threads,
}: {
  threads: DMThreadPreview[];
}) {
  return (
    <div className="grid gap-2">
      {threads.map((t) => (
        <Link
          key={t.id}
          href={`/dm/${t.id}`}
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div>
              <div className="flex items-center gap-2">
                <div className="font-medium">{t.name}</div>
                {t.unread ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {t.lastMessage}
              </div>
            </div>
          </div>
          <div className="text-xs text-neutral-400">{t.time}</div>
        </Link>
      ))}
    </div>
  );
}
