"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark, ChevronDown, ChevronUp, Send, Trash2, Flag, MoreHorizontal } from "lucide-react";
import { likeItem, unlikeItem, bookmarkItem, unbookmarkItem } from "@/app/actions/social";
import { addComment, deleteComment, likeComment, unlikeComment } from "@/app/actions/comments";
import { ReportModal } from "@/components/ui/report-modal";
import { ShareModal } from "@/components/ui/share-modal";
import { Avatar } from "@/components/ui/optimized-image";

export type FeedCardComment = {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  likeCount?: number;
  isLiked?: boolean;
};

export type FeedCardItem = {
  id: string;
  title: string;
  description?: string | null;
  image_url: string | null;
  image_urls?: string[];
  category?: string | null;
  brand?: string | null;
  visibility: "public" | "unlisted" | "private";
  owner_id?: string;
  owner: { handle: string; display_name: string | null; avatar_url?: string | null };
};

type FeedCardProps = {
  item: FeedCardItem;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  initialLikeCount?: number;
  initialComments?: FeedCardComment[];
  initialCommentCount?: number;
  isLoggedIn?: boolean;
  currentUserId?: string;
};

export function FeedCard({ 
  item, 
  initialLiked = false, 
  initialBookmarked = false,
  initialLikeCount = 0,
  initialComments = [],
  initialCommentCount = 0,
  isLoggedIn = false,
  currentUserId,
}: FeedCardProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLiked, setIsLiked] = React.useState(initialLiked);
  const [isBookmarked, setIsBookmarked] = React.useState(initialBookmarked);
  const [likeCount, setLikeCount] = React.useState(initialLikeCount);
  const [loadingLike, setLoadingLike] = React.useState(false);
  const [loadingBookmark, setLoadingBookmark] = React.useState(false);
  
  // Expanded view state
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [comments, setComments] = React.useState<FeedCardComment[]>(initialComments);
  const [commentCount, setCommentCount] = React.useState(initialCommentCount);
  const [newComment, setNewComment] = React.useState("");
  const [loadingComment, setLoadingComment] = React.useState(false);
  const [loadingCommentLike, setLoadingCommentLike] = React.useState<string | null>(null);
  
  // Report state
  const [showItemReportModal, setShowItemReportModal] = React.useState(false);
  const [showCommentReportModal, setShowCommentReportModal] = React.useState(false);
  const [reportingCommentId, setReportingCommentId] = React.useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = React.useState(false);
  
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
    setShowShareModal(true);
  };

  const handleAddComment = async () => {
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    const content = newComment.trim();
    if (!content) return;

    setLoadingComment(true);
    try {
      const result = await addComment(item.id, content);
      if (result.success && result.comment) {
        // Optimistically add the comment to the list
        // In a real app, we'd need to fetch user info here
        setComments((prev) => [
          {
            id: result.comment.id,
            content: result.comment.content,
            created_at: result.comment.created_at,
            user: {
              id: currentUserId ?? "",
              handle: "me", // This will be replaced by actual display
              display_name: "나",
              avatar_url: null,
            },
          },
          ...prev,
        ]);
        setCommentCount((prev) => prev + 1);
        setNewComment("");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setLoadingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const result = await deleteComment(commentId, item.id);
    if (result.success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((prev) => prev - 1);
    }
  };

  const handleCommentLikeToggle = async (commentId: string, isCurrentlyLiked: boolean) => {
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }

    setLoadingCommentLike(commentId);
    try {
      if (isCurrentlyLiked) {
        const result = await unlikeComment(commentId);
        if (result.success) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId
                ? { ...c, isLiked: false, likeCount: Math.max(0, (c.likeCount ?? 0) - 1) }
                : c
            )
          );
        }
      } else {
        const result = await likeComment(commentId);
        if (result.success) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId
                ? { ...c, isLiked: true, likeCount: (c.likeCount ?? 0) + 1 }
                : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Comment like toggle failed:", error);
    } finally {
      setLoadingCommentLike(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* User header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link href={`/u/${item.owner.handle}`} className="flex items-center gap-2">
          <Avatar
            src={item.owner.avatar_url}
            alt={item.owner.display_name ?? item.owner.handle}
            size="xs"
            fallbackInitial={(item.owner.display_name ?? item.owner.handle).charAt(0).toUpperCase()}
          />
          <span className="text-xs font-medium hover:underline">@{item.owner.handle}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link 
            href={`/u/${item.owner.handle}`}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            View Profile
          </Link>
          {/* More menu */}
          {currentUserId !== item.owner_id && (
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMoreMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowMoreMenu(false)} 
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                    <button
                      onClick={() => {
                        setShowItemReportModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Flag className="h-4 w-4" />
                      신고하기
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Slider */}
      <div className="relative block">
        <div className="relative aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-900">
          {images.length > 0 ? (
            <Image
              src={images[currentIndex]}
              alt={item.title}
              fill
              priority={currentIndex === 0}
              loading={currentIndex === 0 ? "eager" : "lazy"}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
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
      </div>

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
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{commentCount > 0 ? commentCount : "Comment"}</span>
        </button>
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
        {item.description && !isExpanded && (
          <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2 dark:text-neutral-400">
            {item.description}
          </p>
        )}

        {/* Top 3 comments preview (sorted by likes) */}
        {!isExpanded && comments.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            {[...comments]
              .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
              .slice(0, 3)
              .map((comment) => (
                <div key={comment.id} className="flex items-start gap-2">
                  <Link
                    href={`/u/${comment.user.handle}`}
                    className="shrink-0 text-xs font-medium hover:underline"
                  >
                    {comment.user.display_name ?? comment.user.handle}
                  </Link>
                  <p className="flex-1 text-xs text-neutral-600 line-clamp-1 dark:text-neutral-400">
                    {comment.content}
                  </p>
                  {(comment.likeCount ?? 0) > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-neutral-400">
                      <Heart className="h-2.5 w-2.5 fill-current text-red-400" />
                      {comment.likeCount}
                    </span>
                  )}
                </div>
              ))}
            {comments.length > 3 && (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                댓글 {comments.length - 3}개 더 보기...
              </button>
            )}
          </div>
        )}

        {/* Expand/Collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          {isExpanded ? (
            <>
              접기 <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              상세 보기 <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
          {/* Full description */}
          {item.description && (
            <div className="mb-4">
              <h4 className="mb-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                설명
              </h4>
              <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                {item.description}
              </p>
            </div>
          )}

          {/* Item details */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            {item.brand && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  브랜드
                </h4>
                <p className="text-sm">{item.brand}</p>
              </div>
            )}
            {item.category && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  카테고리
                </h4>
                <p className="text-sm">{item.category}</p>
              </div>
            )}
          </div>

          {/* Comments section */}
          <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <h4 className="mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              댓글 {commentCount > 0 && `(${commentCount})`}
            </h4>

            {/* Add comment input */}
            {isLoggedIn && (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder="댓글 작성..."
                  disabled={loadingComment}
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-300 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-600"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || loadingComment}
                  className="rounded-lg bg-neutral-900 px-3 py-2 text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Comment list */}
            {comments.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Link
                      href={`/u/${comment.user.handle}`}
                    >
                      <Avatar
                        src={comment.user.avatar_url}
                        alt={comment.user.display_name ?? comment.user.handle}
                        size="xs"
                        fallbackInitial={(comment.user.display_name ?? comment.user.handle).charAt(0).toUpperCase()}
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/u/${comment.user.handle}`}
                          className="text-xs font-medium hover:underline"
                        >
                          {comment.user.display_name ?? comment.user.handle}
                        </Link>
                        <span className="text-[10px] text-neutral-400">
                          {formatTime(comment.created_at)}
                        </span>
                        {(currentUserId === comment.user.id || currentUserId === item.owner_id) ? (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="ml-auto text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : currentUserId && currentUserId !== comment.user.id && (
                          <button
                            onClick={() => {
                              setReportingCommentId(comment.id);
                              setShowCommentReportModal(true);
                            }}
                            className="ml-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                            title="신고하기"
                          >
                            <Flag className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                        {comment.content}
                      </p>
                      {/* Comment like button */}
                      <button
                        onClick={() => handleCommentLikeToggle(comment.id, comment.isLiked ?? false)}
                        disabled={loadingCommentLike === comment.id}
                        className={`mt-1 flex items-center gap-1 text-[10px] transition-colors disabled:opacity-50 ${
                          comment.isLiked
                            ? "text-red-500"
                            : "text-neutral-400 hover:text-red-500"
                        }`}
                      >
                        <Heart className={`h-3 w-3 ${comment.isLiked ? "fill-current" : ""}`} />
                        <span>{(comment.likeCount ?? 0) > 0 ? comment.likeCount : ""}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-neutral-400">
                {isLoggedIn ? "첫 번째 댓글을 남겨보세요" : "아직 댓글이 없습니다"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Item Report Modal */}
      <ReportModal
        isOpen={showItemReportModal}
        onClose={() => setShowItemReportModal(false)}
        type="item"
        targetId={item.id}
        targetName={item.title}
      />

      {/* Comment Report Modal */}
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemId={item.id}
        itemTitle={item.title}
        itemImageUrl={images[0]}
      />
    </div>
  );
}
