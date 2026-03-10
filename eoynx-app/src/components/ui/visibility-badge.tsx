export function VisibilityBadge({ visibility }: { visibility: "public" | "unlisted" | "private" }) {
  const label = visibility === "public" ? "Public" : visibility === "unlisted" ? "Unlisted" : "Private";
  const cls =
    visibility === "public"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : visibility === "unlisted"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>{label}</span>
  );
}
