export const UI_FIELD_LABEL =
  "mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400";

export const UI_SECTION_TITLE =
  "mb-3 text-xs text-neutral-500 dark:text-neutral-400";

export const UI_FIELD_HINT = "mt-1 text-xs text-neutral-500 dark:text-neutral-400";

export const UI_FIELD_ERROR = "mt-1.5 text-xs text-red-600 dark:text-red-400";

export const UI_INPUT_BASE =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:placeholder:text-neutral-600 dark:focus:border-neutral-700";

export const UI_SECTION_CARD =
  "rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black";

export const UI_PRIMARY_BUTTON =
  "w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400";

export function uiInputClass(options?: {
  invalid?: boolean;
  className?: string;
}): string {
  const invalidClass = options?.invalid
    ? "border-red-400 focus:border-red-500 dark:border-red-700 dark:focus:border-red-600"
    : "";

  return [UI_INPUT_BASE, invalidClass, options?.className ?? ""]
    .filter(Boolean)
    .join(" ");
}
