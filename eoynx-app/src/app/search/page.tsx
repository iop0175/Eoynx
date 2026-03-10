import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { UserHeader } from "@/components/ui/user-header";
import { FeedCard, type FeedCardItem } from "@/components/ui/feed-card";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Search",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "unlisted" | "private";
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  profiles: { handle: string; display_name: string | null } | null;
};

export default async function SearchPage({ searchParams }: Props) {
  const t = await getTranslations('search');
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createSupabaseServerClient();

  const peoplePromise = query
    ? supabase
        .from("profiles")
        .select("id,handle,display_name,avatar_url")
        .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10)
        .returns<ProfileRow[]>()
    : Promise.resolve({ data: [] as ProfileRow[], error: null });

  // Items are protected by RLS: anon can only see public/unlisted
  const itemsPromise = query
    ? supabase
        .from("items")
        .select("id,title,description,visibility,image_url,image_urls,category,profiles(handle,display_name)")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ItemRow[]>()
    : Promise.resolve({ data: [] as ItemRow[], error: null });

  const [{ data: people, error: peopleErr }, { data: items, error: itemsErr }] =
    await Promise.all([peoplePromise, itemsPromise]);

  // Convert items to FeedCardItem format
  const feedItems: FeedCardItem[] = (items ?? []).map((it) => ({
    id: it.id,
    title: it.title,
    description: it.description,
    image_url: it.image_url,
    image_urls: it.image_urls ?? [],
    category: it.category,
    visibility: it.visibility,
    owner: {
      handle: it.profiles?.handle ?? "unknown",
      display_name: it.profiles?.display_name ?? null,
    },
  }));

  return (
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder={t('placeholder')}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
        />
        <button
          type="submit"
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {t('go')}
        </button>
      </form>

      {peopleErr || itemsErr ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {t('error')}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6">
        {/* People section */}
        {(people?.length ?? 0) > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('people')}</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{people?.length ?? 0}</span>
            </div>
            <div className="grid gap-2">
              {(people ?? []).map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
                >
                  <UserHeader handle={p.handle} displayName={p.display_name} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Items section - Feed style */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('items')}</h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{feedItems.length}</span>
          </div>
          <div className="grid gap-4">
            {feedItems.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
            {query && feedItems.length === 0 ? (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('noResults')}</div>
            ) : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
