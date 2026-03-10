"use client";

import * as React from "react";

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1 text-xs dark:border-neutral-800 dark:bg-black">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "rounded-full px-3 py-2 font-medium transition-colors " +
              (active
                ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
