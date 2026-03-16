"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { FeedCard, type FeedCardItem, type FeedCardComment } from "@/components/ui/feed-card";
import { FeedSkeleton } from "@/components/ui/feed-skeleton";
import { fetchFeedPage, type FeedPageData } from "@/app/actions/feed";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { id: "all", label: "For you" },
  { id: "luxury", label: "Luxury" },
  { id: "accessories", label: "Accessories" },
  { id: "cars", label: "Cars" },
  { id: "real-estate", label: "Real Estate" },
];

type FeedClientProps = {
  initialData: FeedPageData;
  isLoggedIn?: boolean;
  currentUserId?: string;
};

export function FeedClient({ 
  initialData,
  isLoggedIn = false,
  currentUserId,
}: FeedClientProps) {
  const [selected, setSelected] = React.useState("all");
  const [items, setItems] = React.useState<FeedCardItem[]>(initialData.items);
  const [interactions, setInteractions] = React.useState(initialData.interactions);
  const [likeCounts, setLikeCounts] = React.useState(initialData.likeCounts);
  const [comments, setComments] = React.useState(initialData.comments);
  const [commentCounts, setCommentCounts] = React.useState(initialData.commentCounts);
  const [hasMore, setHasMore] = React.useState(initialData.hasMore);
  const [nextCursor, setNextCursor] = React.useState(initialData.nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [categoryLoading, setCategoryLoading] = React.useState(false);
  
  const observerRef = React.useRef<HTMLDivElement>(null);

  // Filter items by category (for client-side filtering of already loaded items)
  const filteredItems = selected === "all" 
    ? items 
    : items.filter((item) => item.category?.toLowerCase() === selected);

  // Reset and fetch when category changes
  const handleCategoryChange = async (category: string) => {
    if (category === selected) return;
    
    setSelected(category);
    setCategoryLoading(true);
    
    try {
      const data = await fetchFeedPage(null, category);
      setItems(data.items);
      setInteractions(data.interactions);
      setLikeCounts(data.likeCounts);
      setComments(data.comments);
      setCommentCounts(data.commentCounts);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Failed to fetch feed:", error);
    } finally {
      setCategoryLoading(false);
    }
  };

  // Load more items
  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore || !nextCursor) return;
    
    setLoading(true);
    try {
      const data = await fetchFeedPage(nextCursor, selected);
      
      setItems((prev) => [...prev, ...data.items]);
      setInteractions((prev) => ({
        likes: { ...prev.likes, ...data.interactions.likes },
        bookmarks: { ...prev.bookmarks, ...data.interactions.bookmarks },
      }));
      setLikeCounts((prev) => ({ ...prev, ...data.likeCounts }));
      setComments((prev) => ({ ...prev, ...data.comments }));
      setCommentCounts((prev) => ({ ...prev, ...data.commentCounts }));
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Failed to load more:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextCursor, selected]);

  // 현재 표시 중인 아이템 ID 추적
  const feedItemIdsRef = React.useRef<Set<string>>(new Set(items.map((item) => item.id)));
  
  React.useEffect(() => {
    feedItemIdsRef.current = new Set(items.map((item) => item.id));
  }, [items]);

  // Intersection Observer for infinite scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // 좋아요 실시간 구독 (Supabase Realtime)
  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
    
    const refreshLikeState = async (itemId: string) => {
      if (typeof document !== "undefined" && document.hidden) return;

      const [countRes, likedRes] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("item_id", itemId),
        currentUserId
          ? supabase.from("likes").select("id").eq("item_id", itemId).eq("user_id", currentUserId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (countRes.error || likedRes.error) return;

      setLikeCounts((prev) => ({ ...prev, [itemId]: countRes.count ?? 0 }));
      if (currentUserId) {
        setInteractions((prev) => ({
          ...prev,
          likes: { ...prev.likes, [itemId]: Boolean(likedRes.data) },
        }));
      }
    };

    const scheduleLikeRefresh = (itemId: string) => {
      const prevTimer = refreshTimers.get(itemId);
      if (prevTimer) {
        clearTimeout(prevTimer);
      }

      const nextTimer = setTimeout(() => {
        refreshTimers.delete(itemId);
        void refreshLikeState(itemId);
      }, 250);

      refreshTimers.set(itemId, nextTimer);
    };

    const channel = supabase
      .channel(`feed-likes:${currentUserId ?? "anon"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
        },
        (payload: { new?: { item_id?: string }; old?: { item_id?: string } }) => {
          const affectedItemId = payload?.new?.item_id ?? payload?.old?.item_id;
          if (!affectedItemId) return;
          if (!feedItemIdsRef.current.has(affectedItemId)) return;
          scheduleLikeRefresh(affectedItemId);
        }
      )
      .subscribe();

    return () => {
      refreshTimers.forEach((timer) => clearTimeout(timer));
      refreshTimers.clear();
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            disabled={categoryLoading}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              selected === cat.id
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Feed list */}
      <div className="grid gap-4">
        {categoryLoading ? (
          <FeedSkeleton count={3} />
        ) : (
          <>
            {filteredItems.map((item) => (
              <FeedCard 
                key={item.id} 
                item={item}
                initialLiked={interactions?.likes[item.id] ?? false}
                initialBookmarked={interactions?.bookmarks[item.id] ?? false}
                initialLikeCount={likeCounts?.[item.id] ?? 0}
                initialComments={comments?.[item.id] ?? []}
                initialCommentCount={commentCounts?.[item.id] ?? 0}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
              />
            ))}
            
            {filteredItems.length === 0 && !loading && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                No items found.
              </div>
            )}
          </>
        )}
      </div>

      {/* Loading indicator & infinite scroll trigger */}
      <div 
        ref={observerRef} 
        className="flex justify-center py-8"
      >
        {loading && (
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        )}
        {!loading && !hasMore && items.length > 0 && (
          <p className="text-sm text-neutral-400">
            더 이상 아이템이 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
