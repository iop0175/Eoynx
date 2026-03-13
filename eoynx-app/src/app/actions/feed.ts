"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedCardItem, FeedCardComment } from "@/components/ui/feed-card";
import { checkBatchInteractions, getBatchLikeCounts } from "@/app/actions/social";
import { getCommentLikeCounts, checkCommentLikeStatus } from "@/app/actions/comments";

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  brand: string | null;
  visibility: "public" | "unlisted" | "private";
  owner_id: string;
  created_at: string;
  profiles: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

export type FeedPageData = {
  items: FeedCardItem[];
  interactions: {
    likes: Record<string, boolean>;
    bookmarks: Record<string, boolean>;
  };
  likeCounts: Record<string, number>;
  comments: Record<string, FeedCardComment[]>;
  commentCounts: Record<string, number>;
  hasMore: boolean;
  nextCursor: string | null;
};

const PAGE_SIZE = 5;

export async function fetchFeedPage(cursor?: string | null, category?: string): Promise<FeedPageData> {
  const supabase = await createSupabaseServerClient();

  // Parse cursor (format: created_at:id)
  let cursorDate: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const [date, id] = cursor.split("::");
    cursorDate = date;
    cursorId = id;
  }

  // Build query
  let query = supabase
    .from("items")
    .select("id,title,description,image_url,image_urls,category,brand,visibility,owner_id,created_at,profiles(handle,display_name,avatar_url)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1); // Fetch one extra to check if there's more

  // Apply category filter if not "all"
  if (category && category !== "all") {
    query = query.ilike("category", category);
  }

  // Apply cursor for pagination (use .or for same created_at with different id)
  if (cursorDate && cursorId) {
    query = query.or(`created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`);
  }

  const { data: items } = await query.returns<ItemRow[]>();

  if (!items || items.length === 0) {
    return {
      items: [],
      interactions: { likes: {}, bookmarks: {} },
      likeCounts: {},
      comments: {},
      commentCounts: {},
      hasMore: false,
      nextCursor: null,
    };
  }

  // Check if there are more items
  const hasMore = items.length > PAGE_SIZE;
  const pageItems = hasMore ? items.slice(0, PAGE_SIZE) : items;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor = hasMore && lastItem ? `${lastItem.created_at}::${lastItem.id}` : null;

  const itemIds = pageItems.map((i) => i.id);

  // Fetch interactions, like counts, and comments in parallel
  const [interactions, likeCounts] = await Promise.all([
    checkBatchInteractions(itemIds),
    getBatchLikeCounts(itemIds),
  ]);

  // Fetch comments
  let allComments: {
    id: string;
    item_id: string;
    content: string;
    created_at: string;
    profiles: unknown;
  }[] | null = null;

  if (itemIds.length > 0) {
    const { data } = await supabase
      .from("comments")
      .select(`
        id,
        item_id,
        content,
        created_at,
        profiles(id, handle, display_name, avatar_url)
      `)
      .in("item_id", itemIds)
      .order("created_at", { ascending: false });
    allComments = data;
  }

  // Group comments by item_id and format
  const commentsMap: Record<string, FeedCardComment[]> = {};
  const commentCountsMap: Record<string, number> = {};
  const allCommentIds: string[] = [];

  itemIds.forEach((id) => {
    commentsMap[id] = [];
    commentCountsMap[id] = 0;
  });

  allComments?.forEach((comment) => {
    const itemId = comment.item_id;
    if (!commentsMap[itemId]) {
      commentsMap[itemId] = [];
    }
    commentCountsMap[itemId] = (commentCountsMap[itemId] ?? 0) + 1;

    if (commentsMap[itemId].length < 5) {
      allCommentIds.push(comment.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = comment.profiles as any;
      commentsMap[itemId].push({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          id: profile?.id ?? "",
          handle: profile?.handle ?? "unknown",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
        likeCount: 0,
        isLiked: false,
      });
    }
  });

  // Fetch comment likes data
  const [commentLikeCounts, commentLikeStatus] = await Promise.all([
    getCommentLikeCounts(allCommentIds),
    checkCommentLikeStatus(allCommentIds),
  ]);

  // Update comments with like data
  for (const itemId of itemIds) {
    commentsMap[itemId] = commentsMap[itemId].map((comment) => ({
      ...comment,
      likeCount: commentLikeCounts[comment.id] ?? 0,
      isLiked: commentLikeStatus.has(comment.id),
    }));
  }

  const feed: FeedCardItem[] = pageItems.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    image_url: i.image_url,
    image_urls: i.image_urls ?? [],
    category: i.category,
    brand: i.brand,
    visibility: i.visibility,
    owner_id: i.owner_id,
    owner: {
      handle: i.profiles?.handle ?? "unknown",
      display_name: i.profiles?.display_name ?? null,
      avatar_url: i.profiles?.avatar_url ?? null,
    },
  }));

  return {
    items: feed,
    interactions,
    likeCounts,
    comments: commentsMap,
    commentCounts: commentCountsMap,
    hasMore,
    nextCursor,
  };
}
