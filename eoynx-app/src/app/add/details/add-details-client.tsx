"use client";

import * as React from "react";
import { PageShell } from "@/components/page-shell";
import { Segmented } from "@/components/ui/segmented";

export default function AddDetailsClientPage() {
  const [visibility, setVisibility] = React.useState("public");

  return (
    <PageShell title="Add Details" subtitle="Visibility + metadata.">
      <div className="grid gap-4">
        <div>
          <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Visibility</div>
          <Segmented
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "public", label: "Public" },
              { value: "unlisted", label: "Unlisted" },
              { value: "private", label: "Private" },
            ]}
          />
        </div>

        <div className="grid gap-2">
          <input
            placeholder="Title"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
          />
          <textarea
            placeholder="Description"
            className="min-h-28 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
          />
        </div>

        <button
          type="button"
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Publish (skeleton)
        </button>
      </div>
    </PageShell>
  );
}
