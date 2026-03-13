"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, Share2, MessageSquare, Download, Share, Flag, Ban, MoreHorizontal, ArrowUpDown } from "lucide-react";
import { followUser, unfollowUser } from "@/app/actions/social";
import { getOrCreateThread } from "@/app/actions/dm";
import { blockUser, unblockUser } from "@/app/actions/safety";
import { getProfileItems, type ProfileItemSortBy } from "@/app/actions/profile";
import { ReportModal } from "@/components/ui/report-modal";
import { Avatar } from "@/components/ui/optimized-image";
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
  like_count?: number;
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
  categoryPercentiles?: Record<string, number>;
  items: ProfileItem[];
  isOwner: boolean;
  isFollowing?: boolean;
  isLoggedIn?: boolean;
  isBlocked?: boolean;
  translations?: {
    sortBy: string;
    sortLatest: string;
    sortOldest: string;
    sortLikes: string;
    noItemsInCategory: string;
  };
};

export function ProfileClient({ 
  profile, 
  stats, 
  categoryPercentiles = {},
  items: initialItems, 
  isOwner,
  isFollowing: initialIsFollowing = false,
  isLoggedIn = false,
  isBlocked: initialIsBlocked = false,
  translations,
}: ProfileClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState("overall");
  const [isFollowing, setIsFollowing] = React.useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = React.useState(stats.followers);
  const [loading, setLoading] = React.useState(false);
  const [dmLoading, setDmLoading] = React.useState(false);
  const [isBlocked, setIsBlocked] = React.useState(initialIsBlocked);
  const [blockLoading, setBlockLoading] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  
  // Sort state
  const [sortBy, setSortBy] = React.useState<ProfileItemSortBy>("latest");
  const [items, setItems] = React.useState<ProfileItem[]>(initialItems);
  const [sortLoading, setSortLoading] = React.useState(false);
  const [showSortMenu, setShowSortMenu] = React.useState(false);

  // Default translations
  const t = translations ?? {
    sortBy: "Sort",
    sortLatest: "Latest",
    sortOldest: "Oldest",
    sortLikes: "Most liked",
    noItemsInCategory: "No items in this category.",
  };

  // Sort options
  const sortOptions: { value: ProfileItemSortBy; label: string }[] = [
    { value: "latest", label: t.sortLatest },
    { value: "oldest", label: t.sortOldest },
    { value: "likes", label: t.sortLikes },
  ];

  // Handle sort change
  const handleSortChange = async (newSortBy: ProfileItemSortBy) => {
    if (newSortBy === sortBy) {
      setShowSortMenu(false);
      return;
    }
    
    setSortLoading(true);
    setShowSortMenu(false);
    
    try {
      const result = await getProfileItems(profile.id, newSortBy);
      if (!result.error) {
        setItems(result.items);
        setSortBy(newSortBy);
      }
    } catch (error) {
      console.error("Failed to sort items:", error);
    } finally {
      setSortLoading(false);
    }
  };

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

  const handleDownloadShareCard = async () => {
    try {
      const response = await fetch(`/api/share/profile/${profile.handle}`);
      if (!response.ok) throw new Error("Failed to generate share card");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile.handle}-share-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download share card:", error);
    }
  };

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/u/${profile.handle}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.display_name || `@${profile.handle}`,
          text: profile.bio || `Check out ${profile.display_name || `@${profile.handle}`} on EOYNX`,
          url,
        });
      } catch {
        // User cancelled or share failed
        navigator.clipboard.writeText(url);
      }
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const handleBlockToggle = async () => {
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setBlockLoading(true);
    try {
      if (isBlocked) {
        const result = await unblockUser(profile.id);
        if (!result.error) {
          setIsBlocked(false);
        }
      } else {
        const result = await blockUser(profile.id);
        if (!result.error) {
          setIsBlocked(true);
          // Also unfollow when blocking
          if (isFollowing) {
            await unfollowUser(profile.id);
            setIsFollowing(false);
            setFollowerCount((prev) => prev - 1);
          }
        }
      }
    } catch (error) {
      console.error("Block toggle failed:", error);
    } finally {
      setBlockLoading(false);
      setShowMoreMenu(false);
    }
  };

  // Filter items by category
  const filteredItems = selectedCategory === "overall"
    ? items
    : items.filter((item) => item.category?.toLowerCase() === selectedCategory);

  // Calculate rank percentage based on selected category
  const rankPercent = selectedCategory === "overall" 
    ? (stats.rank ?? 50)
    : (categoryPercentiles[selectedCategory] ?? 50);

  // Get category label for display
  const categoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label ?? "Overall";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Profile Header */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar
            src={profile.avatar_url}
            alt={profile.display_name ?? profile.handle}
            size="xl"
            fallbackInitial={(profile.display_name ?? profile.handle).charAt(0).toUpperCase()}
          />

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {profile.display_name ?? profile.handle}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">@{profile.handle}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Link
                  href={`/u/${profile.handle}/followers`}
                  className="rounded-lg px-2 py-1 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {followerCount.toLocaleString()}
                  </span>{" "}
                  <span className="text-neutral-600 dark:text-neutral-300">Followers</span>
                </Link>
                <Link
                  href={`/u/${profile.handle}/following`}
                  className="rounded-lg px-2 py-1 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {stats.following.toLocaleString()}
                  </span>{" "}
                  <span className="text-neutral-600 dark:text-neutral-300">Following</span>
                </Link>
              </div>
            </div>

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

            {/* Share actions */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleShareProfile}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Share className="h-3 w-3" />
                Share
              </button>
              <button
                onClick={handleDownloadShareCard}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Download className="h-3 w-3" />
                Share Card
              </button>
              
              {/* More menu for report/block */}
              {!isOwner && (
                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  
                  {showMoreMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowMoreMenu(false)} 
                      />
                      <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        <button
                          onClick={() => {
                            setShowReportModal(true);
                            setShowMoreMenu(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          <Flag className="h-4 w-4" />
                          신고하기
                        </button>
                        <button
                          onClick={handleBlockToggle}
                          disabled={blockLoading}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                            isBlocked 
                              ? "text-neutral-700 dark:text-neutral-300" 
                              : "text-red-600 dark:text-red-500"
                          }`}
                        >
                          <Ban className="h-4 w-4" />
                          {blockLoading ? "..." : isBlocked ? "차단 해제" : "차단하기"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
          <div className="text-2xl font-bold">Top {rankPercent}%</div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {categoryLabel} vault • Global
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

      {/* Sort controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {filteredItems.length} items
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            disabled={sortLoading}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortOptions.find((o) => o.value === sortBy)?.label ?? t.sortBy}
          </button>
          
          {showSortMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowSortMenu(false)} 
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                      sortBy === opt.value
                        ? "font-medium text-violet-600 dark:text-violet-400"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 gap-3">
        {sortLoading ? (
          <div className="col-span-2 flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          </div>
        ) : filteredItems.map((item) => (
          <ProfileItemCard key={item.id} item={item} />
        ))}
        {!sortLoading && filteredItems.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            {t.noItemsInCategory}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        type="user"
        targetId={profile.id}
        targetName={profile.display_name ?? `@${profile.handle}`}
      />
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
      <div className="relative aspect-square w-full bg-neutral-100 dark:bg-neutral-900">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 33vw"
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
