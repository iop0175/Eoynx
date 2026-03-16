import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { searchPeople, searchItems, type SearchSortBy, type SearchCategory } from "@/app/actions/search";
import { SearchClient } from "./search-client";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://eoynx.com").trim();

export const metadata: Metadata = {
  title: "Search",
  description: "Search public profiles and item pages across EOYNX.",
  alternates: {
    canonical: "/search",
  },
  openGraph: {
    title: "Search · EOYNX",
    description: "Search public profiles and item pages across EOYNX.",
    type: "website",
    url: `${BASE_URL}/search`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Search · EOYNX",
    description: "Search public profiles and item pages across EOYNX.",
    images: [`${BASE_URL}/opengraph-image`],
  },
};

type Props = {
  searchParams: Promise<{ q?: string; sort?: string; category?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const t = await getTranslations('search');
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  
  // Parse sort and category from URL
  const sortBy: SearchSortBy = (params.sort === "oldest" || params.sort === "likes") 
    ? params.sort 
    : "latest";
  const category: SearchCategory = (
    params.category === "Luxury" || 
    params.category === "Accessories" || 
    params.category === "Cars" || 
    params.category === "Real-Estate"
  ) ? params.category : "all";

  // Fetch initial data with filters
  const [peopleResult, itemsResult] = await Promise.all([
    query ? searchPeople(query, 0) : Promise.resolve({ people: [], hasMore: false, nextOffset: 0 }),
    query ? searchItems(query, null, { sortBy, category }) : Promise.resolve({ items: [], hasMore: false, nextCursor: null }),
  ]);

  return (
    <SearchClient
      initialQuery={query}
      initialPeople={peopleResult.people}
      initialItems={itemsResult.items}
      initialHasMoreItems={itemsResult.hasMore}
      initialItemsCursor={itemsResult.nextCursor}
      initialSortBy={sortBy}
      initialCategory={category}
      translations={{
        title: t('title'),
        subtitle: t('subtitle'),
        placeholder: t('placeholder'),
        go: t('go'),
        people: t('people'),
        items: t('items'),
        noResults: t('noResults'),
        filters: t('filters'),
        sortBy: t('sortBy'),
        category: t('category'),
        sortLatest: t('sortLatest'),
        sortOldest: t('sortOldest'),
        sortLikes: t('sortLikes'),
        categoryAll: t('categoryAll'),
        categoryLuxury: t('categoryLuxury'),
        categoryAccessories: t('categoryAccessories'),
        categoryCars: t('categoryCars'),
        categoryRealEstate: t('categoryRealEstate'),
        clearFilters: t('clearFilters'),
      }}
    />
  );
}
