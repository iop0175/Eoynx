"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedCardItem } from "@/components/ui/feed-card";

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
  created_at: string;
  brand: string | null;
  like_count: number;
  profiles: { handle: string; display_name: string | null } | null;
};

export type SearchPeopleResult = {
  people: ProfileRow[];
  hasMore: boolean;
  nextOffset: number;
};

export type SearchItemsResult = {
  items: FeedCardItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type SearchSortBy = "latest" | "oldest" | "likes";
export type SearchCategory = "all" | "Luxury" | "Accessories" | "Cars" | "Real-Estate";

export type SearchFilters = {
  sortBy?: SearchSortBy;
  category?: SearchCategory;
};

const PEOPLE_PAGE_SIZE = 10;
const ITEMS_PAGE_SIZE = 10;

export async function searchPeople(
  query: string,
  offset: number = 0
): Promise<SearchPeopleResult> {
  if (!query.trim()) {
    return { people: [], hasMore: false, nextOffset: 0 };
  }

  const supabase = await createSupabaseServerClient();

  const { data: people } = await supabase
    .from("profiles")
    .select("id,handle,display_name,avatar_url")
    .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
    .range(offset, offset + PEOPLE_PAGE_SIZE)
    .returns<ProfileRow[]>();

  const hasMore = (people?.length ?? 0) > PEOPLE_PAGE_SIZE;
  const pageItems = hasMore ? people?.slice(0, PEOPLE_PAGE_SIZE) : people;

  return {
    people: pageItems ?? [],
    hasMore,
    nextOffset: offset + PEOPLE_PAGE_SIZE,
  };
}

export async function searchItems(
  query: string,
  cursor?: string | null,
  filters?: SearchFilters
): Promise<SearchItemsResult> {
  if (!query.trim()) {
    return { items: [], hasMore: false, nextCursor: null };
  }

  const supabase = await createSupabaseServerClient();
  const sortBy = filters?.sortBy ?? "latest";
  const category = filters?.category ?? "all";
  const selectClause =
    sortBy === "likes"
      ? "id,title,description,visibility,image_url,image_urls,category,created_at,brand,profiles(handle,display_name),likes:likes(count)"
      : "id,title,description,visibility,image_url,image_urls,category,created_at,brand,profiles(handle,display_name)";

  // Build base query with like_count
  let dbQuery = supabase
    .from("items")
    .select(selectClause)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`)
    .eq("visibility", "public");
  
  // Apply category filter
  if (category !== "all") {
    dbQuery = dbQuery.eq("category", category);
  }

  // Apply sorting
  if (sortBy === "latest") {
    dbQuery = dbQuery.order("created_at", { ascending: false });
    if (cursor) {
      dbQuery = dbQuery.lt("created_at", cursor);
    }
  } else if (sortBy === "oldest") {
    dbQuery = dbQuery.order("created_at", { ascending: true });
    if (cursor) {
      dbQuery = dbQuery.gt("created_at", cursor);
    }
  } else {
    // likes sorting - need to fetch all then sort client-side for now
    dbQuery = dbQuery.order("created_at", { ascending: false });
  }

  dbQuery = dbQuery.limit(ITEMS_PAGE_SIZE + 1);

  const { data: rawItems } = await dbQuery;

  if (!rawItems || rawItems.length === 0) {
    return { items: [], hasMore: false, nextCursor: null };
  }

  // Transform raw data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items = (rawItems as any[]).map((it) => {
    // profiles can be an object or array depending on the join
    const profile = Array.isArray(it.profiles) ? it.profiles[0] : it.profiles;
    const likeCount =
      sortBy === "likes" && Array.isArray(it.likes) ? (it.likes[0]?.count ?? 0) : 0;
    
    return {
      id: it.id as string,
      title: it.title as string,
      description: it.description as string | null,
      visibility: it.visibility as "public" | "unlisted" | "private",
      image_url: it.image_url as string | null,
      image_urls: (it.image_urls ?? []) as string[],
      category: it.category as string | null,
      created_at: it.created_at as string,
      brand: it.brand as string | null,
      profiles: profile as { handle: string; display_name: string | null } | null,
      like_count: likeCount as number,
    };
  });

  // If sorting by likes, sort client-side
  if (sortBy === "likes") {
    items = items.sort((a, b) => b.like_count - a.like_count);
  }

  const hasMore = items.length > ITEMS_PAGE_SIZE;
  const pageItems = hasMore ? items.slice(0, ITEMS_PAGE_SIZE) : items;
  const nextCursor = hasMore ? pageItems[pageItems.length - 1].created_at : null;

  const feedItems: FeedCardItem[] = pageItems.map((it) => ({
    id: it.id,
    title: it.title,
    description: it.description,
    image_url: it.image_url,
    image_urls: it.image_urls,
    category: it.category,
    visibility: it.visibility,
    owner: {
      handle: it.profiles?.handle ?? "unknown",
      display_name: it.profiles?.display_name ?? null,
    },
  }));

  return {
    items: feedItems,
    hasMore,
    nextCursor,
  };
}
