"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { FeedCard, type FeedCardItem } from "@/components/ui/feed-card";
import { UserHeader } from "@/components/ui/user-header";
import { Button } from "@/components/ui/button";
import { UI_INPUT_BASE } from "@/components/ui/ui-classes";
import {
  searchPeople,
  searchItems,
  type SearchPeopleResult,
  type SearchItemsResult,
  type SearchSortBy,
  type SearchCategory,
  type SearchFilters,
} from "@/app/actions/search";

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
  const searchParams = useSearchParams();
  
  const [query, setQuery] = React.useState(initialQuery);
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
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          name="q"
          defaultValue={initialQuery}
          placeholder={t.placeholder}
          className={UI_INPUT_BASE}
        />
        <Button type="submit" variant="neutral" className="py-3">
          {t.go}
        </Button>
        <Button
          type="button"
          variant={hasActiveFilters ? "primary" : "secondary"}
          className="py-3 px-3"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{t.filters}</h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                {t.clearFilters}
              </button>
            )}
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Sort by */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                {t.sortBy}
              </label>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSortBy(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortBy === opt.value
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                {t.category}
              </label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      category === opt.value
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apply button */}
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="neutral" onClick={applyFilters} disabled={loadingItems}>
              {loadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : t.go}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6">
        {/* People section */}
        {people.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t.people}</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{people.length}</span>
            </div>
            <div className="grid gap-2">
              {people.map((p) => (
                <Link
                  key={p.id}
                  href={`/u/${p.handle}`}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
                >
                  <UserHeader handle={p.handle} displayName={p.display_name} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Items section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t.items}</h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{items.length}</span>
          </div>
          <div className="grid gap-4">
            {items.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
            
            {initialQuery && items.length === 0 && !loadingItems ? (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.noResults}</div>
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
