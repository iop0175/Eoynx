"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { addComment, deleteComment, updateComment, type CommentWithUser } from "@/app/actions/comments";
import { Avatar } from "@/components/ui/optimized-image";
import { ReportModal } from "@/components/ui/report-modal";

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
  const t = useTranslations("comments");
  const [comments, setComments] = React.useState(initialComments);
  const [total, setTotal] = React.useState(initialTotal);
  const [newComment, setNewComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [replyTargetId, setReplyTargetId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState("");
  const [processingCommentId, setProcessingCommentId] = React.useState<string | null>(null);
  const [showCommentReportModal, setShowCommentReportModal] = React.useState(false);
  const [reportingCommentId, setReportingCommentId] = React.useState<string | null>(null);

  const topLevelComments = React.useMemo(
    () => comments
      .filter((comment) => !comment.parent_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [comments]
  );

  const repliesByParent = React.useMemo(() => {
    const map = new Map<string, CommentWithUser[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      const current = map.get(comment.parent_id) ?? [];
      current.push(comment);
      map.set(comment.parent_id, current);
    }
    for (const [parentId, list] of map.entries()) {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      map.set(parentId, list);
    }
    return map;
  }, [comments]);

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
      setComments((prev) => [
        {
          id: result.comment.id,
          content: result.comment.content,
          created_at: result.comment.created_at,
          parent_id: result.comment.parent_id ?? null,
          user_id: currentUserId ?? "",
          profiles: null,
        },
        ...prev,
      ]);
      setTotal((prev) => prev + 1);
      setNewComment("");
    }
    setSubmitting(false);
  };

  const handleReplySubmit = async (parentId: string) => {
    const content = replyDraft.trim();
    if (!content || processingCommentId) return;

    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setProcessingCommentId(parentId);
    const result = await addComment(itemId, content, parentId);

    if (result.success && result.comment) {
      setComments((prev) => [
        ...prev,
        {
          id: result.comment.id,
          content: result.comment.content,
          created_at: result.comment.created_at,
          parent_id: result.comment.parent_id ?? parentId,
          user_id: currentUserId ?? "",
          profiles: null,
        },
      ]);
      setTotal((prev) => prev + 1);
      setReplyTargetId(null);
      setReplyDraft("");
    }

    setProcessingCommentId(null);
  };

  const handleEditStart = (comment: CommentWithUser) => {
    setEditingCommentId(comment.id);
    setEditDraft(comment.content);
  };

  const handleEditSave = async (commentId: string) => {
    const content = editDraft.trim();
    if (!content || processingCommentId) return;

    setProcessingCommentId(commentId);
    const result = await updateComment(commentId, content);
    if (result.success) {
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? { ...comment, content } : comment
        )
      );
      setEditingCommentId(null);
      setEditDraft("");
    }
    setProcessingCommentId(null);
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditDraft("");
  };

  const collectCommentFamilyIds = React.useCallback((targetId: string) => {
    const childrenMap = new Map<string, string[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      const current = childrenMap.get(comment.parent_id) ?? [];
      current.push(comment.id);
      childrenMap.set(comment.parent_id, current);
    }

    const toDelete = new Set<string>([targetId]);
    const queue = [targetId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const children = childrenMap.get(current) ?? [];
      for (const childId of children) {
        if (toDelete.has(childId)) continue;
        toDelete.add(childId);
        queue.push(childId);
      }
    }

    return toDelete;
  }, [comments]);

  const handleDelete = async (commentId: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;

    setProcessingCommentId(commentId);
    const result = await deleteComment(commentId, itemId);
    if (result.success) {
      if (result.mode === "hard") {
        const familyIds = collectCommentFamilyIds(commentId);
        setComments((prev) => prev.filter((c) => !familyIds.has(c.id)));
        setTotal((prev) => Math.max(0, prev - familyIds.size));
      } else if (result.mode === "soft_owner") {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? { ...comment, content: t("deletedByOwner") }
              : comment
          )
        );
      } else {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? { ...comment, content: t("deletedByAuthor") }
              : comment
          )
        );
      }
    }
    setProcessingCommentId(null);
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
      <div className="max-h-96 overflow-y-auto bg-neutral-50/60 dark:bg-neutral-950/40">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const canDelete = currentUserId === comment.user_id || isItemOwner;
            const canEdit = currentUserId === comment.user_id;
            const handle = comment.profiles?.handle ?? "user";
            const displayName = comment.profiles?.display_name ?? handle;
            const replies = repliesByParent.get(comment.id) ?? [];

            return (
              <div key={comment.id} className="p-3">
                <div className="flex gap-3">
                  <Link href={`/u/${handle}`}>
                    <Avatar
                      src={comment.profiles?.avatar_url}
                      alt={displayName}
                      size="sm"
                      fallbackInitial={displayName.charAt(0).toUpperCase()}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link href={`/u/${handle}`} className="truncate text-sm font-medium hover:underline">
                            {displayName}
                          </Link>
                          <span className="text-xs text-neutral-400">{formatDate(comment.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {isLoggedIn && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTargetId(replyTargetId === comment.id ? null : comment.id);
                                setReplyDraft("");
                              }}
                              className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                            >
                              Reply
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleEditStart(comment)}
                              className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(comment.id)}
                              disabled={processingCommentId === comment.id}
                              className="text-red-600 hover:text-red-500 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          )}
                          {currentUserId && currentUserId !== comment.user_id && (
                            <button
                              type="button"
                              onClick={() => {
                                setReportingCommentId(comment.id);
                                setShowCommentReportModal(true);
                              }}
                              className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                            >
                              Report
                            </button>
                          )}
                        </div>
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                            rows={2}
                            maxLength={1000}
                          />
                          <div className="flex justify-end gap-3 text-xs">
                            <button type="button" onClick={handleEditCancel} className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditSave(comment.id)}
                              disabled={!editDraft.trim() || processingCommentId === comment.id}
                              className="font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                          {comment.content}
                        </p>
                      )}
                    </div>

                    {replyTargetId === comment.id && (
                      <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Write a reply..."
                          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                          rows={2}
                          maxLength={1000}
                        />
                        <div className="mt-2 flex justify-end gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTargetId(null);
                              setReplyDraft("");
                            }}
                            className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReplySubmit(comment.id)}
                            disabled={!replyDraft.trim() || processingCommentId === comment.id}
                            className="font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}

                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 border-l border-neutral-200 pl-3 dark:border-neutral-700">
                        {replies.map((reply) => {
                          const replyCanDelete = currentUserId === reply.user_id || isItemOwner;
                          const replyCanEdit = currentUserId === reply.user_id;
                          const replyHandle = reply.profiles?.handle ?? "user";
                          const replyDisplayName = reply.profiles?.display_name ?? replyHandle;

                          return (
                            <div key={reply.id} className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
                              <Link href={`/u/${replyHandle}`} className="self-start">
                                <Avatar
                                  src={reply.profiles?.avatar_url}
                                  alt={replyDisplayName}
                                  size="xs"
                                  fallbackInitial={replyDisplayName.charAt(0).toUpperCase()}
                                />
                              </Link>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Link href={`/u/${replyHandle}`} className="truncate text-xs font-medium hover:underline">
                                      {replyDisplayName}
                                    </Link>
                                    <span className="text-xs text-neutral-400">{formatDate(reply.created_at)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    {replyCanEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleEditStart(reply)}
                                        className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {replyCanDelete && (
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(reply.id)}
                                        disabled={processingCommentId === reply.id}
                                        className="text-red-600 hover:text-red-500 disabled:opacity-60"
                                      >
                                        Delete
                                      </button>
                                    )}
                                    {currentUserId && currentUserId !== reply.user_id && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReportingCommentId(reply.id);
                                          setShowCommentReportModal(true);
                                        }}
                                        className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                                      >
                                        Report
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {editingCommentId === reply.id ? (
                                  <div className="mt-2 space-y-2">
                                    <textarea
                                      value={editDraft}
                                      onChange={(e) => setEditDraft(e.target.value)}
                                      className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
                                      rows={2}
                                      maxLength={1000}
                                    />
                                    <div className="flex justify-end gap-3 text-xs">
                                      <button
                                        type="button"
                                        onClick={handleEditCancel}
                                        className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditSave(reply.id)}
                                        disabled={!editDraft.trim() || processingCommentId === reply.id}
                                        className="font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                                    {reply.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ReportModal
        isOpen={showCommentReportModal}
        onClose={() => {
          setShowCommentReportModal(false);
          setReportingCommentId(null);
        }}
        type="comment"
        targetId={reportingCommentId ?? ""}
        targetName="댓글"
      />
    </div>
  );
}
