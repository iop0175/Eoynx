"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { likeItem, unlikeItem, bookmarkItem, unbookmarkItem } from "@/app/actions/social";

export type FeedCardItem = {
  id: string;
  title: string;
  description?: string | null;
  image_url: string | null;
  image_urls?: string[];
  category?: string | null;
  visibility: "public" | "unlisted" | "private";
  owner: { handle: string; display_name: string | null; avatar_url?: string | null };
};

type FeedCardProps = {
  item: FeedCardItem;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  initialLikeCount?: number;
  isLoggedIn?: boolean;
};

export function FeedCard({ 
  item, 
  initialLiked = false, 
  initialBookmarked = false,
  initialLikeCount = 0,
  isLoggedIn = false,
}: FeedCardProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLiked, setIsLiked] = React.useState(initialLiked);
  const [isBookmarked, setIsBookmarked] = React.useState(initialBookmarked);
  const [likeCount, setLikeCount] = React.useState(initialLikeCount);
  const [loadingLike, setLoadingLike] = React.useState(false);
  const [loadingBookmark, setLoadingBookmark] = React.useState(false);
  
  // Use image_urls if available, fallback to image_url
  const images = item.image_urls && item.image_urls.length > 0
    ? item.image_urls
    : item.image_url
    ? [item.image_url]
    : [];

  const goToPrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setLoadingLike(true);
    try {
      if (isLiked) {
        const result = await unlikeItem(item.id);
        if (result.success) {
          setIsLiked(false);
          setLikeCount((prev) => prev - 1);
        }
      } else {
        const result = await likeItem(item.id);
        if (result.success) {
          setIsLiked(true);
          setLikeCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Like toggle failed:", error);
    } finally {
      setLoadingLike(false);
    }
  };

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setLoadingBookmark(true);
    try {
      if (isBookmarked) {
        const result = await unbookmarkItem(item.id);
        if (result.success) {
          setIsBookmarked(false);
        }
      } else {
        const result = await bookmarkItem(item.id);
        if (result.success) {
          setIsBookmarked(true);
        }
      }
    } catch (error) {
      console.error("Bookmark toggle failed:", error);
    } finally {
      setLoadingBookmark(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/i/${item.id}`;
    if (navigator.share) {
      navigator.share({
        title: item.title,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      // Could add a toast notification here
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* User header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link href={`/u/${item.owner.handle}`} className="flex items-center gap-2">
          <div className="h-7 w-7 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            {item.owner.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.owner.avatar_url}
                alt={item.owner.display_name ?? item.owner.handle}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                {(item.owner.display_name ?? item.owner.handle).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-xs font-medium hover:underline">@{item.owner.handle}</span>
        </Link>
        <Link 
          href={`/u/${item.owner.handle}`}
          className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          View Profile
        </Link>
      </div>

      {/* Image Slider */}
      <Link href={`/i/${item.id}`} className="relative block">
        <div className="aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-900">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[currentIndex]}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-3xl">📦</span>
            </div>
          )}
        </div>

        {/* Navigation arrows for multiple images */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              aria-label="Next image"
            >
              <ChevronRight className="h-3 w-3" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((_, index) => (
                <span
                  key={index}
                  className={`h-1 w-1 rounded-full transition-colors ${
                    index === currentIndex ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </Link>

      {/* Action buttons */}
      <div className="flex items-center gap-4 px-4 py-2">
        <button
          onClick={handleLikeToggle}
          disabled={loadingLike}
          className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
            isLiked
              ? "text-red-500"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
          <span>{likeCount > 0 ? likeCount.toLocaleString() : "Like"}</span>
        </button>
        <Link
          href={`/i/${item.id}#comments`}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Comment</span>
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>
        <button
          onClick={handleBookmarkToggle}
          disabled={loadingBookmark}
          className={`ml-auto flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
            isBookmarked
              ? "text-amber-500"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Item info */}
      <div className="px-4 pb-3">
        <div className="text-sm font-medium">{item.title}</div>
        {item.description && (
          <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2 dark:text-neutral-400">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}
