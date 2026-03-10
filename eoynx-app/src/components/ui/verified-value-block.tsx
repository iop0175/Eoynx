import { formatMoneyMinor } from "@/lib/format";

export function VerifiedValueBlock({
  currency,
  minorUnit,
  medianMinor,
  minMinor,
  maxMinor,
  sources,
}: {
  currency: string;
  minorUnit: number;
  medianMinor: number | null;
  minMinor: number | null;
  maxMinor: number | null;
  sources?: Array<{ label: string; url?: string | null }>;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Verified value</div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">median + range</div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Min</div>
          <div className="mt-1 text-sm font-medium">
            {formatMoneyMinor(minMinor, currency, minorUnit) || "—"}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Median</div>
          <div className="mt-1 text-sm font-medium">
            {formatMoneyMinor(medianMinor, currency, minorUnit) || "—"}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Max</div>
          <div className="mt-1 text-sm font-medium">
            {formatMoneyMinor(maxMinor, currency, minorUnit) || "—"}
          </div>
        </div>
      </div>

      {sources && sources.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.slice(0, 6).map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            >
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
