"use client";

import * as React from "react";
import { FeedCard, type FeedCardItem } from "@/components/ui/feed-card";

const CATEGORIES = [
  { id: "all", label: "For you" },
  { id: "luxury", label: "Luxury" },
  { id: "accessories", label: "Accessories" },
  { id: "cars", label: "Cars" },
  { id: "real-estate", label: "Real Estate" },
];

type FeedClientProps = {
  items: FeedCardItem[];
  interactions?: {
    likes: Record<string, boolean>;
    bookmarks: Record<string, boolean>;
  };
  likeCounts?: Record<string, number>;
  isLoggedIn?: boolean;
};

export function FeedClient({ 
  items, 
  interactions,
  likeCounts,
  isLoggedIn = false,
}: FeedClientProps) {
  const [selected, setSelected] = React.useState("all");

  // Filter items by category (for now, "all" shows all items)
  const filteredItems = selected === "all" 
    ? items 
    : items.filter((item) => item.category?.toLowerCase() === selected);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
        {filteredItems.map((item) => (
          <FeedCard 
            key={item.id} 
            item={item}
            initialLiked={interactions?.likes[item.id] ?? false}
            initialBookmarked={interactions?.bookmarks[item.id] ?? false}
            initialLikeCount={likeCounts?.[item.id] ?? 0}
            isLoggedIn={isLoggedIn}
          />
        ))}
        {filteredItems.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            No items found.
          </div>
        )}
      </div>
    </div>
  );
}
