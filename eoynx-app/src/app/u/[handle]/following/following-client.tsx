"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { unfollowUser, getFollowingPaginated, type FollowUser } from "@/app/actions/social";
import { Avatar } from "@/components/ui/optimized-image";
import { useRouter } from "next/navigation";

type FollowingListClientProps = {
  userId: string;
  initialUsers: FollowUser[];
  initialHasMore: boolean;
  initialCursor: string | null;
  isOwner: boolean;
};

export function FollowingListClient({
  userId,
  initialUsers,
  initialHasMore,
  initialCursor,
  isOwner,
}: FollowingListClientProps) {
  const [users, setUsers] = React.useState<FollowUser[]>(initialUsers);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [removedIds, setRemovedIds] = React.useState<Set<string>>(new Set());

  const observerRef = React.useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter((user) => !removedIds.has(user.id));

  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore || !cursor) return;

    setLoading(true);
    try {
      const result = await getFollowingPaginated(userId, cursor);
      setUsers((prev) => [...prev, ...result.users]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to load more following:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor, userId]);

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

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {filteredUsers.length === 0 && !hasMore ? (
        <div className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
          아직 팔로우하는 사람이 없습니다
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredUsers.map((user) => (
              <FollowUserCard
                key={user.id}
                user={user}
                isOwner={isOwner}
                onUnfollow={() => setRemovedIds((prev) => new Set(prev).add(user.id))}
              />
            ))}
          </ul>

          {hasMore && (
            <div ref={observerRef} className="flex justify-center py-4">
              {loading && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FollowUserCard({
  user,
  isOwner,
  onUnfollow,
}: {
  user: FollowUser;
  isOwner: boolean;
  onUnfollow: () => void;
}) {
  const router = useRouter();
  const [unfollowing, setUnfollowing] = React.useState(false);

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setUnfollowing(true);
    try {
      const result = await unfollowUser(user.id);
      if (result.success) {
        onUnfollow();
        router.refresh();
      }
    } catch (error) {
      console.error("Unfollow failed:", error);
    } finally {
      setUnfollowing(false);
    }
  };

  return (
    <li>
      <Link
        href={`/u/${user.handle}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
      >
        <Avatar
          src={user.avatar_url}
          alt={user.display_name ?? user.handle}
          size="md"
          fallbackInitial={(user.display_name ?? user.handle).charAt(0).toUpperCase()}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-900 dark:text-white">
            {user.display_name ?? user.handle}
          </p>
          <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            @{user.handle}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={handleUnfollow}
            disabled={unfollowing}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {unfollowing ? "..." : "팔로잉 취소"}
          </button>
        )}
      </Link>
    </li>
  );
}
