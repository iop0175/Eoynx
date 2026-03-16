import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://eoynx.com").trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "EOYNX",
  description: "Public luxury collections. SEO-first profiles + items.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "luxury collection",
    "public profile",
    "collectibles",
    "item valuation",
    "share cards",
  ],
  openGraph: {
    title: "EOYNX",
    description: "Public luxury collections. SEO-first profiles + items.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "EOYNX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EOYNX",
    description: "Public luxury collections. SEO-first profiles + items.",
    images: ["/twitter-image"],
  },
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-300/70 bg-white/80 px-3 py-1 text-xs text-neutral-700 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-200">
      {children}
    </span>
  );
}

function isCrawlerUserAgent(userAgent: string): boolean {
  const normalized = userAgent.toLowerCase();
  return [
    "googlebot",
    "bingbot",
    "duckduckbot",
    "yandexbot",
    "baiduspider",
    "slurp",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot",
    "applebot",
    "petalbot",
    "bytespider",
  ].some((bot) => normalized.includes(bot));
}

export default async function HomePage() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const isCrawler = isCrawlerUserAgent(userAgent);

  if (!isCrawler) {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((cookie) => cookie.name.includes("sb-") && cookie.name.includes("auth-token"));

    if (hasAuthCookie) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        redirect("/feed");
      }
    }
  }

  const t = await getTranslations('home');
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EOYNX",
    url: SITE_URL,
    description: "Public luxury collections. SEO-first profiles + items.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,#fef3c7_0%,transparent_42%),radial-gradient(circle_at_85%_0%,#99f6e4_0%,transparent_36%),linear-gradient(180deg,#fffbeb_0%,#ffffff_60%,#f8fafc_100%)] text-neutral-900 dark:bg-[radial-gradient(circle_at_15%_10%,#3f2e11_0%,transparent_42%),radial-gradient(circle_at_85%_0%,#113a35_0%,transparent_36%),linear-gradient(180deg,#0a0a0a_0%,#000000_70%)] dark:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pointer-events-none absolute -left-24 top-28 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/20" />
      <div className="pointer-events-none absolute -right-16 top-10 h-72 w-72 rounded-full bg-teal-300/30 blur-3xl dark:bg-teal-500/20" />

      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher />
      </div>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-20 sm:px-6 sm:pt-24">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-neutral-200/80 bg-white/70 p-6 shadow-xl shadow-neutral-900/5 backdrop-blur sm:p-8 dark:border-neutral-800 dark:bg-neutral-950/70 dark:shadow-black/30">
            <div className="flex flex-wrap gap-2">
              <Chip>{t('chips.seoFirst')}</Chip>
              <Chip>{t('chips.publicProfiles')}</Chip>
              <Chip>{t('chips.shareCards')}</Chip>
              <Chip>{t('chips.verifiedValue')}</Chip>
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {t('hero.title1')}
              <br className="hidden sm:block" />
              {t('hero.title2')}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-700 sm:text-base dark:text-neutral-300">
              {t('hero.description')}
            </p>

            <div className="mt-7 rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-100 to-teal-100 p-4 shadow-md shadow-amber-200/40 sm:p-5 dark:border-amber-500/30 dark:from-amber-900/30 dark:to-teal-900/30 dark:shadow-black/20">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700 dark:text-neutral-200">
                Start here
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  href="/u/demo"
                  className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  {t('cta.viewProfile')}
                </Link>
                <Link
                  href="/i/8e40eb10-3aa6-46ae-8fc3-07db79f36e0b"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  {t('cta.viewItem')}
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200/80 bg-neutral-950 p-6 text-white shadow-xl shadow-neutral-900/20 sm:p-8 dark:border-neutral-700">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-300">EOYNX</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs text-neutral-300">{t('stats.categories')}</div>
                <div className="mt-2 text-sm font-medium leading-6 text-neutral-100">{t('stats.categoriesValue')}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs text-neutral-300">{t('stats.visibility')}</div>
                <div className="mt-2 text-sm font-medium leading-6 text-neutral-100">{t('stats.visibilityValue')}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-400/90 p-3 text-neutral-900">
                <div className="text-[11px] font-medium uppercase tracking-wider">{t('stats.verified')}</div>
                <div className="mt-1 text-xs font-semibold">{t('stats.verifiedValue')}</div>
              </div>
              <div className="rounded-xl bg-teal-300/90 p-3 text-neutral-900">
                <div className="text-[11px] font-medium uppercase tracking-wider">{t('stats.share')}</div>
                <div className="mt-1 text-xs font-semibold">{t('stats.shareValue')}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200/80 bg-white/80 p-4 text-xs backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="text-neutral-500 dark:text-neutral-400">{t('stats.categories')}</div>
            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{t('stats.categoriesValue')}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/80 p-4 text-xs backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="text-neutral-500 dark:text-neutral-400">{t('stats.visibility')}</div>
            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{t('stats.visibilityValue')}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/80 p-4 text-xs backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="text-neutral-500 dark:text-neutral-400">{t('stats.verified')}</div>
            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{t('stats.verifiedValue')}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/80 p-4 text-xs backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="text-neutral-500 dark:text-neutral-400">{t('stats.share')}</div>
            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{t('stats.shareValue')}</div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-neutral-200/80 bg-white/80 p-6 backdrop-blur sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/70">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('seo.sectionTitle')}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-700 sm:text-base dark:text-neutral-300">
            {t('seo.sectionDescription')}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h3 className="text-sm font-semibold">{t('seo.point1Title')}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{t('seo.point1Body')}</p>
            </article>
            <article className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h3 className="text-sm font-semibold">{t('seo.point2Title')}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{t('seo.point2Body')}</p>
            </article>
            <article className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h3 className="text-sm font-semibold">{t('seo.point3Title')}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{t('seo.point3Body')}</p>
            </article>
          </div>

          <div className="mt-7 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-950/80">
            <h3 className="text-sm font-semibold">{t('seo.crawlTitle')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/search" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlSearch')}
              </Link>
              <Link href="/u/demo" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlProfile')}
              </Link>
              <Link href="/i/8e40eb10-3aa6-46ae-8fc3-07db79f36e0b" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlItem')}
              </Link>
            </div>

            <h3 className="mt-5 text-sm font-semibold">{t('seo.popularSearches')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/search?category=Luxury" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlLuxury')}
              </Link>
              <Link href="/search?category=Accessories" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlAccessories')}
              </Link>
              <Link href="/search?category=Cars" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlCars')}
              </Link>
              <Link href="/search?category=Real-Estate" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                {t('seo.crawlRealEstate')}
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
