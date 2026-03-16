"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, SlidersHorizontal } from "lucide-react";
import type { FeedCardItem } from "@/components/ui/feed-card";
import { UserHeader } from "@/components/ui/user-header";
import { Button } from "@/components/ui/button";
import { UI_INPUT_BASE } from "@/components/ui/ui-classes";
import {
  searchItems,
  type SearchSortBy,
  type SearchCategory,
} from "@/app/actions/search";

const FeedCard = dynamic(
  () => import("@/components/ui/feed-card").then((mod) => mod.FeedCard),
  {
    loading: () => (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-black">
        <div className="h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 h-52 w-full animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
    ),
  }
);

const SearchFiltersPanel = dynamic(
  () => import("./search-filters-panel").then((mod) => mod.SearchFiltersPanel),
  {
    loading: () => (
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
    ),
  }
);

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

type SearchClientProps = {
  initialQuery: string;
  initialPeople: ProfileRow[];
  initialItems: FeedCardItem[];
  initialHasMoreItems: boolean;
  initialItemsCursor: string | null;
  initialSortBy: SearchSortBy;
  initialCategory: SearchCategory;
  translations: {
    title: string;
    subtitle: string;
    placeholder: string;
    go: string;
    people: string;
    items: string;
    noResults: string;
    filters: string;
    sortBy: string;
    category: string;
    sortLatest: string;
    sortOldest: string;
    sortLikes: string;
    categoryAll: string;
    categoryLuxury: string;
    categoryAccessories: string;
    categoryCars: string;
    categoryRealEstate: string;
    clearFilters: string;
  };
};

export function SearchClient({
  initialQuery,
  initialPeople,
  initialItems,
  initialHasMoreItems,
  initialItemsCursor,
  initialSortBy,
  initialCategory,
  translations: t,
}: SearchClientProps) {
  const router = useRouter();
  const searchInputId = React.useId();
  const filtersPanelId = React.useId();
  const peopleHeadingId = React.useId();
  const itemsHeadingId = React.useId();

  const [people, setPeople] = React.useState<ProfileRow[]>(initialPeople);
  const [items, setItems] = React.useState<FeedCardItem[]>(initialItems);
  const [hasMoreItems, setHasMoreItems] = React.useState(initialHasMoreItems);
  const [itemsCursor, setItemsCursor] = React.useState<string | null>(initialItemsCursor);
  const [loadingItems, setLoadingItems] = React.useState(false);
  
  // Filter states
  const [showFilters, setShowFilters] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<SearchSortBy>(initialSortBy);
  const [category, setCategory] = React.useState<SearchCategory>(initialCategory);
  
  const observerRef = React.useRef<HTMLDivElement>(null);

  // Handle search form submit - include filters in URL
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newQuery = formData.get("q")?.toString() ?? "";
    const params = new URLSearchParams();
    params.set("q", newQuery);
    if (sortBy !== "latest") params.set("sort", sortBy);
    if (category !== "all") params.set("category", category);
    router.push(`/search?${params.toString()}`);
  };

  // Apply filters - reload with new params
  const applyFilters = async () => {
    if (!initialQuery) return;
    
    setLoadingItems(true);
    setItems([]);
    setItemsCursor(null);
    
    try {
      const result = await searchItems(initialQuery, null, { sortBy, category });
      setItems(result.items);
      setHasMoreItems(result.hasMore);
      setItemsCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to apply filters:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSortBy("latest");
    setCategory("all");
    if (initialQuery) {
      router.push(`/search?q=${encodeURIComponent(initialQuery)}`);
    }
  };

  // Check if filters are active
  const hasActiveFilters = sortBy !== "latest" || category !== "all";

  // Load more items
  const loadMoreItems = React.useCallback(async () => {
    if (loadingItems || !hasMoreItems || !itemsCursor || !initialQuery) return;
    
    setLoadingItems(true);
    try {
      const result = await searchItems(initialQuery, itemsCursor, { sortBy, category });
      
      setItems((prev) => [...prev, ...result.items]);
      setHasMoreItems(result.hasMore);
      setItemsCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to load more items:", error);
    } finally {
      setLoadingItems(false);
    }
  }, [loadingItems, hasMoreItems, itemsCursor, initialQuery, sortBy, category]);

  // Intersection Observer for infinite scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreItems && !loadingItems) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreItems, loadingItems, loadMoreItems]);

  // Reset state when URL query changes
  React.useEffect(() => {
    setPeople(initialPeople);
    setItems(initialItems);
    setHasMoreItems(initialHasMoreItems);
    setItemsCursor(initialItemsCursor);
    setSortBy(initialSortBy);
    setCategory(initialCategory);
  }, [initialPeople, initialItems, initialHasMoreItems, initialItemsCursor, initialSortBy, initialCategory]);

  // Sort options
  const sortOptions: { value: SearchSortBy; label: string }[] = [
    { value: "latest", label: t.sortLatest },
    { value: "oldest", label: t.sortOldest },
    { value: "likes", label: t.sortLikes },
  ];

  // Category options
  const categoryOptions: { value: SearchCategory; label: string }[] = [
    { value: "all", label: t.categoryAll },
    { value: "Luxury", label: t.categoryLuxury },
    { value: "Accessories", label: t.categoryAccessories },
    { value: "Cars", label: t.categoryCars },
    { value: "Real-Estate", label: t.categoryRealEstate },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
        {t.title}
      </h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">{t.subtitle}</p>

      {/* Search form */}
      <form onSubmit={handleSearch} role="search" aria-label={t.title} className="flex gap-2">
        <label htmlFor={searchInputId} className="sr-only">
          {t.placeholder}
        </label>
        <input
          id={searchInputId}
          name="q"
          defaultValue={initialQuery}
          placeholder={t.placeholder}
          className={UI_INPUT_BASE}
        />
        <Button type="submit" variant="neutral" className="min-w-[72px] whitespace-nowrap px-4 py-3">
          {t.go}
        </Button>
        <Button
          type="button"
          variant={hasActiveFilters ? "primary" : "secondary"}
          className="py-3 px-3"
          onClick={() => setShowFilters(!showFilters)}
          aria-label={t.filters}
          aria-expanded={showFilters}
          aria-controls={filtersPanelId}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div id={filtersPanelId}>
          <SearchFiltersPanel
            title={t.filters}
            sortByLabel={t.sortBy}
            categoryLabel={t.category}
            clearLabel={t.clearFilters}
            applyLabel={t.go}
            hasActiveFilters={hasActiveFilters}
            loading={loadingItems}
            sortBy={sortBy}
            category={category}
            sortOptions={sortOptions}
            categoryOptions={categoryOptions}
            onSortChange={setSortBy}
            onCategoryChange={setCategory}
            onClear={clearFilters}
            onApply={applyFilters}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6">
        {/* People section */}
        {people.length > 0 && (
          <section aria-labelledby={peopleHeadingId}>
            <div className="mb-2 flex items-center justify-between">
              <h2 id={peopleHeadingId} className="text-sm font-semibold text-neutral-900 dark:text-white">{t.people}</h2>
              <span aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">{people.length}</span>
            </div>
            <div className="grid gap-2">
              {people.map((p) => (
                <Link
                  key={p.id}
                  href={`/u/${p.handle}`}
                  prefetch={false}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
                >
                  <UserHeader handle={p.handle} displayName={p.display_name} showProfileLink={false} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Items section */}
        <section aria-labelledby={itemsHeadingId}>
          <div className="mb-3 flex items-center justify-between">
            <h2 id={itemsHeadingId} className="text-sm font-semibold text-neutral-900 dark:text-white">{t.items}</h2>
            <span aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">{items.length}</span>
          </div>
          <div className="grid gap-4">
            {items.map((item, index) => (
              <FeedCard
                key={item.id}
                item={item}
                imagePriority={index === 0}
                imageSizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 720px"
                disablePrefetchLinks
              />
            ))}
            
            {initialQuery && items.length === 0 && !loadingItems ? (
              <div role="status" aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">
                {t.noResults}
              </div>
            ) : null}
          </div>

          {/* Loading indicator & infinite scroll trigger */}
          {hasMoreItems && (
            <div ref={observerRef} className="flex justify-center py-6">
              {loadingItems && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
