import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Home } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-6xl font-bold text-neutral-200 dark:text-neutral-800">
        404
      </div>

      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        {t("description")}
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          <Home className="h-4 w-4" />
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
