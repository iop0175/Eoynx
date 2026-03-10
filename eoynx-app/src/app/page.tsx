import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';

export const metadata: Metadata = {
  title: "EOYNX",
  description: "Public luxury collections. SEO-first profiles + items.",
  openGraph: {
    title: "EOYNX",
    description: "Public luxury collections. SEO-first profiles + items.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "EOYNX",
    description: "Public luxury collections. SEO-first profiles + items.",
  },
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
      {children}
    </span>
  );
}

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-black dark:text-white">
      {/* Language Switcher */}
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher />
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-6 dark:border-neutral-800 dark:from-neutral-950 dark:to-black">
          <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(200px_200px_at_40%_30%,black,transparent)]">
            <div className="h-full w-full bg-[conic-gradient(from_200deg_at_40%_30%,#7C3AED_0deg,#7C3AED_160deg,#F97316_280deg,#7C3AED_360deg)]" />
          </div>

          <div className="relative">
            <div className="flex flex-wrap gap-2">
              <Chip>{t('chips.seoFirst')}</Chip>
              <Chip>{t('chips.publicProfiles')}</Chip>
              <Chip>{t('chips.shareCards')}</Chip>
              <Chip>{t('chips.verifiedValue')}</Chip>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight">
              {t('hero.title1')}
              <br />
              {t('hero.title2')}
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {t('hero.description')}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/u/demo"
                className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {t('cta.viewProfile')}
              </Link>
              <Link
                href="/i/8e40eb10-3aa6-46ae-8fc3-07db79f36e0b"
                className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
              >
                {t('cta.viewItem')}
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                <div className="text-neutral-500 dark:text-neutral-400">{t('stats.categories')}</div>
                <div className="mt-1 font-medium">{t('stats.categoriesValue')}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                <div className="text-neutral-500 dark:text-neutral-400">{t('stats.visibility')}</div>
                <div className="mt-1 font-medium">{t('stats.visibilityValue')}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                <div className="text-neutral-500 dark:text-neutral-400">{t('stats.verified')}</div>
                <div className="mt-1 font-medium">{t('stats.verifiedValue')}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                <div className="text-neutral-500 dark:text-neutral-400">{t('stats.share')}</div>
                <div className="mt-1 font-medium">{t('stats.shareValue')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Next */}
        <div className="mt-10 grid gap-3">
          <Link
            href="/debug/supabase"
            className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
          >
            <div className="font-medium">{t('debug.title')}</div>
            <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
              {t('debug.description')}
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
