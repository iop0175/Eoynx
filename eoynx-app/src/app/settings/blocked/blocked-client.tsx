"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, User, X } from "lucide-react";
import { getBlockedUsers, unblockUser } from "@/app/actions/safety";
import { Avatar } from "@/components/ui/optimized-image";

type BlockedUser = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

export function BlockedUsersClient({ initialBlockedUsers }: { initialBlockedUsers: BlockedUser[] }) {
  const [blockedUsers, setBlockedUsers] = React.useState<BlockedUser[]>(initialBlockedUsers);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleUnblock = async (userId: string) => {
    setLoadingId(userId);
    try {
      const result = await unblockUser(userId);
      if (!result.error) {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (error) {
      console.error("Failed to unblock:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/settings"
          className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">차단된 사용자</h1>
      </div>

      {/* Info */}
      <div className="mb-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        차단된 사용자는 회원님의 프로필을 볼 수 없으며, 회원님도 해당 사용자의 콘텐츠를 볼 수 없습니다.
      </div>

      {/* Blocked users list */}
      {blockedUsers.length > 0 ? (
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {blockedUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-4 p-4">
              <Link href={`/u/${user.handle}`}>
                <Avatar
                  src={user.avatar_url}
                  alt={user.display_name ?? user.handle}
                  size="lg"
                  fallbackInitial={(user.display_name ?? user.handle).charAt(0).toUpperCase()}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/u/${user.handle}`} className="block">
                  <div className="font-medium truncate">
                    {user.display_name ?? `@${user.handle}`}
                  </div>
                  {user.display_name && (
                    <div className="text-sm text-neutral-500 truncate">
                      @{user.handle}
                    </div>
                  )}
                </Link>
                <div className="text-xs text-neutral-400">
                  {formatDate(user.blocked_at)} 차단됨
                </div>
              </div>
              <button
                onClick={() => handleUnblock(user.id)}
                disabled={loadingId === user.id}
                className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {loadingId === user.id ? (
                  "..."
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    차단 해제
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
          <div className="mb-2 text-4xl">✓</div>
          <p className="text-neutral-500 dark:text-neutral-400">
            차단된 사용자가 없습니다
          </p>
        </div>
      )}
    </div>
  );
}
