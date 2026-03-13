"use client";

import * as React from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { UI_FIELD_LABEL, UI_INPUT_BASE } from "@/components/ui/ui-classes";

export default function AddDetailsClientPage() {
  const [visibility, setVisibility] = React.useState("public");

  return (
    <PageShell title="Add Details" subtitle="Visibility + metadata.">
      <div className="grid gap-4">
        <div>
          <div className={UI_FIELD_LABEL}>Visibility</div>
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
            className={UI_INPUT_BASE}
          />
          <textarea
            placeholder="Description"
            className={`${UI_INPUT_BASE} min-h-28`}
          />
        </div>

        <Button variant="neutral" className="py-3">
          Publish (skeleton)
        </Button>
      </div>
    </PageShell>
  );
}
