"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getFollowers, getFollowing, type FollowUser } from "@/app/actions/social";
import { Avatar } from "@/components/ui/optimized-image";

type FollowListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
  title: string;
};

export function FollowListModal({
  isOpen,
  onClose,
  userId,
  type,
  title,
}: FollowListModalProps) {
  const [users, setUsers] = React.useState<FollowUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = type === "followers"
          ? await getFollowers(userId)
          : await getFollowing(userId);

        if (result.error) {
          setError(result.error);
        } else {
          setUsers(result.data ?? []);
        }
      } catch (err) {
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen, userId, type]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-500">{error}</div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {type === "followers" ? "아직 팔로워가 없습니다" : "아직 팔로우하는 사람이 없습니다"}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map((user) => (
                <li key={user.id}>
                  <Link
                    href={`/u/${user.handle}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <Avatar
                      src={user.avatar_url}
                      alt={user.display_name ?? user.handle}
                      size="md"
                      fallbackInitial={(user.display_name ?? user.handle).charAt(0).toUpperCase()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-neutral-900 dark:text-white">
                        {user.display_name ?? user.handle}
                      </p>
                      <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                        @{user.handle}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
