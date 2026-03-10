"use client";

import * as React from "react";
import Link from "next/link";
import { Send, Trash2, MoreHorizontal } from "lucide-react";
import { addComment, deleteComment, type CommentWithUser } from "@/app/actions/comments";

type CommentsProps = {
  itemId: string;
  initialComments: CommentWithUser[];
  initialTotal: number;
  isLoggedIn: boolean;
  currentUserId?: string;
  isItemOwner: boolean;
};

export function Comments({
  itemId,
  initialComments,
  initialTotal,
  isLoggedIn,
  currentUserId,
  isItemOwner,
}: CommentsProps) {
  const [comments, setComments] = React.useState(initialComments);
  const [total, setTotal] = React.useState(initialTotal);
  const [newComment, setNewComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setSubmitting(true);
    const result = await addComment(itemId, newComment);

    if (result.success && result.comment) {
      // Optimistically add comment to the top
      // Note: We don't have user profile info yet, so we'll show placeholder
      // In a real app, you'd either refetch or pass user info from context
      setComments([
        {
          id: result.comment.id,
          content: result.comment.content,
          created_at: result.comment.created_at,
          user_id: currentUserId ?? "",
          profiles: null, // Will be filled on next page load
        },
        ...comments,
      ]);
      setTotal(total + 1);
      setNewComment("");
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;

    const result = await deleteComment(commentId, itemId);
    if (result.success) {
      setComments(comments.filter((c) => c.id !== commentId));
      setTotal(total - 1);
    }
    setOpenMenu(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR");
  };

  return (
    <div id="comments" className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h3 className="text-sm font-medium">댓글 {total > 0 && `(${total})`}</h3>
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex gap-3">
          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            {isLoggedIn ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                You
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                ?
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isLoggedIn ? "댓글을 입력하세요..." : "로그인하고 댓글을 남겨보세요"}
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder-neutral-400 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder-neutral-500"
              rows={2}
              maxLength={1000}
              disabled={!isLoggedIn}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                {newComment.length}/1000
              </span>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting || !isLoggedIn}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
                {submitting ? "..." : "댓글"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
          </div>
        ) : (
          comments.map((comment) => {
            const canDelete = currentUserId === comment.user_id || isItemOwner;
            const handle = comment.profiles?.handle ?? "user";
            const displayName = comment.profiles?.display_name ?? handle;

            return (
              <div
                key={comment.id}
                className="border-b border-neutral-100 p-4 last:border-0 dark:border-neutral-800"
              >
                <div className="flex gap-3">
                  {/* Avatar */}
                  <Link
                    href={`/u/${handle}`}
                    className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                  >
                    {comment.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={comment.profiles.avatar_url}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/u/${handle}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {displayName}
                      </Link>
                      <span className="text-xs text-neutral-400">
                        {formatDate(comment.created_at)}
                      </span>

                      {/* Actions menu */}
                      {canDelete && (
                        <div className="relative ml-auto">
                          <button
                            onClick={() => setOpenMenu(openMenu === comment.id ? null : comment.id)}
                            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {openMenu === comment.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                              <button
                                onClick={() => handleDelete(comment.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
