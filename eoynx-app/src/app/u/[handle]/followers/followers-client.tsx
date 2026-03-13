"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { getFollowersPaginated, removeFollower, type FollowUser } from "@/app/actions/social";
import { Avatar } from "@/components/ui/optimized-image";

type FollowersListClientProps = {
  userId: string;
  isOwner: boolean;
  initialUsers: FollowUser[];
  initialHasMore: boolean;
  initialCursor: string | null;
  translations?: {
    noFollowers: string;
    remove: string;
    removing: string;
  };
};

export function FollowersListClient({
  userId,
  isOwner,
  initialUsers,
  initialHasMore,
  initialCursor,
  translations,
}: FollowersListClientProps) {
  const [users, setUsers] = React.useState<FollowUser[]>(initialUsers);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const t = translations ?? {
    noFollowers: "아직 팔로워가 없습니다",
    remove: "삭제",
    removing: "삭제 중...",
  };

  const observerRef = React.useRef<HTMLDivElement>(null);

  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore || !cursor) return;

    setLoading(true);
    try {
      const result = await getFollowersPaginated(userId, cursor);
      setUsers((prev) => [...prev, ...result.users]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to load more followers:", error);
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

  const handleRemoveFollower = async (followerId: string) => {
    setRemovingId(followerId);
    try {
      const result = await removeFollower(followerId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== followerId));
      } else if (result.error) {
        console.error("Failed to remove follower:", result.error);
      }
    } catch (error) {
      console.error("Failed to remove follower:", error);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {users.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t.noFollowers}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {users.map((user) => (
              <FollowUserCard 
                key={user.id} 
                user={user} 
                isOwner={isOwner}
                isRemoving={removingId === user.id}
                onRemove={() => handleRemoveFollower(user.id)}
                removeLabel={removingId === user.id ? t.removing : t.remove}
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
  isRemoving, 
  onRemove, 
  removeLabel 
}: { 
  user: FollowUser; 
  isOwner: boolean;
  isRemoving: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <Link
        href={`/u/${user.handle}`}
        className="flex flex-1 items-center gap-3"
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
      </Link>
      
      {isOwner && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-red-900 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          {isRemoving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {removeLabel}
        </button>
      )}
    </li>
  );
}
