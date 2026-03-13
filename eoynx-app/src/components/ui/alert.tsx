import * as React from "react";

type AlertTone = "error" | "success" | "info";

type AlertProps = {
  tone?: AlertTone;
  className?: string;
  children: React.ReactNode;
};

export function Alert({ tone = "info", className, children }: AlertProps) {
  const tones: Record<AlertTone, string> = {
    error:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200",
    success:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200",
    info:
      "border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100",
  };

  return (
    <div className={["rounded-xl border p-3 text-sm", tones[tone], className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
