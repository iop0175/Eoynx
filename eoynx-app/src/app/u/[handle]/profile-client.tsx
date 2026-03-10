"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Share2, MessageSquare } from "lucide-react";
import { followUser, unfollowUser } from "@/app/actions/social";
import { getOrCreateThread } from "@/app/actions/dm";

const CATEGORIES = [
  { id: "overall", label: "Overall" },
  { id: "luxury", label: "Luxury" },
  { id: "accessories", label: "Accessories" },
  { id: "cars", label: "Cars" },
];

export type ProfileItem = {
  id: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  image_url: string | null;
  image_urls?: string[];
  likes?: number;
};

type ProfileClientProps = {
  profile: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
  stats: {
    items: number;
    followers: number;
    following: number;
    rank?: number;
  };
  items: ProfileItem[];
  isOwner: boolean;
  isFollowing?: boolean;
  isLoggedIn?: boolean;
};

export function ProfileClient({ 
  profile, 
  stats, 
  items, 
  isOwner,
  isFollowing: initialIsFollowing = false,
  isLoggedIn = false,
}: ProfileClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState("overall");
  const [isFollowing, setIsFollowing] = React.useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = React.useState(stats.followers);
  const [loading, setLoading] = React.useState(false);
  const [dmLoading, setDmLoading] = React.useState(false);

  const handleFollowToggle = async () => {
    if (!isLoggedIn) {
      // Redirect to auth or show message
      window.location.href = "/auth";
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        const result = await unfollowUser(profile.id);
        if (result.success) {
          setIsFollowing(false);
          setFollowerCount((prev) => prev - 1);
        }
      } else {
        const result = await followUser(profile.id);
        if (result.success) {
          setIsFollowing(true);
          setFollowerCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Follow toggle failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDM = async () => {
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setDmLoading(true);
    try {
      const result = await getOrCreateThread(profile.id);
      if (result.error) {
        alert(result.error);
      } else if (result.threadId) {
        router.push(`/dm/${result.threadId}`);
      }
    } catch (error) {
      console.error("Failed to start DM:", error);
    } finally {
      setDmLoading(false);
    }
  };

  // Filter items by category
  const filteredItems = selectedCategory === "overall"
    ? items
    : items.filter((item) => item.category?.toLowerCase() === selectedCategory);

  // Calculate rank percentage (mock for now - would come from backend)
  const rankPercent = stats.rank ?? 8;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Profile Header */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? profile.handle}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-400">
                {(profile.display_name ?? profile.handle).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {profile.display_name ?? profile.handle}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">@{profile.handle}</p>

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              {isOwner ? (
                <Link
                  href="/settings/profile"
                  className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:from-amber-500 hover:to-amber-600"
                >
                  Edit Profile
                </Link>
              ) : (
                <>
                  <button
                    onClick={handleFollowToggle}
                    disabled={loading}
                    className={`rounded-full px-4 py-2 text-xs font-medium shadow-sm transition-all disabled:opacity-50 ${
                      isFollowing
                        ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        : "bg-gradient-to-r from-amber-400 to-amber-500 text-white hover:from-amber-500 hover:to-amber-600"
                    }`}
                  >
                    {loading ? "..." : isFollowing ? "Following" : "Follow"}
                  </button>
                  <button
                    onClick={handleStartDM}
                    disabled={dmLoading}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {dmLoading ? "..." : "Message"}
                  </button>
                </>
              )}
            </div>

            {/* DM status */}
            <div className="mt-2 inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              DM: Open
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
          <div className="text-2xl font-bold">Top {rankPercent}%</div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Overall vault • Global
          </div>
        </div>

        {/* Category tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-violet-600 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <ProfileItemCard key={item.id} item={item} />
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            No items in this category.
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileItemCard({ item }: { item: ProfileItem }) {
  const imageUrl = item.image_urls?.[0] ?? item.image_url;

  return (
    <Link
      href={`/i/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
    >
      {/* Image */}
      <div className="aspect-square w-full bg-neutral-100 dark:bg-neutral-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-3xl">📦</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Actions */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            <Heart className="h-3.5 w-3.5" />
            <span>{(item.likes ?? 0).toLocaleString()}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              // Share logic
            }}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
        </div>

        {/* Brand & Title */}
        {item.brand && (
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {item.brand}
          </div>
        )}
        <div className="text-sm font-medium">{item.title}</div>
      </div>
    </Link>
  );
}
