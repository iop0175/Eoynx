"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export function ErrorFallback({
  error,
  reset,
  context,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(`${context ?? "Page"} error:`, error);
  }, [error, context]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t("description")}</p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("retry")}
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          <Home className="h-3.5 w-3.5" />
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
