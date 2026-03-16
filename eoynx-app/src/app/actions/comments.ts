"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

// =====================================================
// Add Comment
// =====================================================

export async function addComment(itemId: string, content: string, parentId?: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { error: "댓글 내용을 입력해주세요" };
  }

  if (trimmedContent.length > 1000) {
    return { error: "댓글은 1000자 이하로 입력해주세요" };
  }

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("comments")
      .select("id, item_id")
      .eq("id", parentId)
      .single();

    if (parentError || !parent) {
      return { error: "원본 댓글을 찾을 수 없습니다" };
    }

    if (parent.item_id !== itemId) {
      return { error: "잘못된 댓글 요청입니다" };
    }
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      item_id: itemId,
      user_id: user.id,
      content: trimmedContent,
      parent_id: parentId ?? null,
    })
    .select("id, content, created_at, parent_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Get item owner for notification
  const { data: item } = await supabase
    .from("items")
    .select("user_id")
    .eq("id", itemId)
    .single();

  if (item && item.user_id !== user.id) {
    await createNotification({
      userId: item.user_id,
      type: "comment",
      actorId: user.id,
      itemId,
      commentId: comment.id,
      preview: trimmedContent.substring(0, 100),
    });
  }

  revalidatePath(`/i/${itemId}`);
  return { success: true, comment };
}

// =====================================================
// Update Comment
// =====================================================

export async function updateComment(commentId: string, content: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { error: "댓글 내용을 입력해주세요" };
  }

  const { data: targetComment, error: targetError } = await supabase
    .from("comments")
    .select("item_id")
    .eq("id", commentId)
    .single();

  if (targetError || !targetComment) {
    return { error: "댓글을 찾을 수 없습니다" };
  }

  const { error } = await supabase
    .from("comments")
    .update({ content: trimmedContent })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/i/${targetComment.item_id}`);
  return { success: true };
}

// =====================================================
// Delete Comment
// =====================================================

export async function deleteComment(commentId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { data, error } = await supabase.rpc("delete_comment_with_policy", {
    p_comment_id: commentId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/i/${itemId}`);
  const mode =
    data && typeof data === "object" && "mode" in data
      ? (data.mode as string)
      : null;

  return { success: true, mode };
}

// =====================================================
// Get Comments for Item
// =====================================================

export type CommentWithUser = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getComments(itemId: string, limit = 50, offset = 0) {
  const supabase = await createSupabaseServerClient();

  const { data: comments, error, count } = await supabase
    .from("comments")
    .select("id, content, created_at, updated_at, user_id, parent_id, profiles(handle, display_name, avatar_url)", { count: "exact" })
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<CommentWithUser[]>();

  if (error) {
    return { comments: [], total: 0 };
  }

  return { comments: comments ?? [], total: count ?? 0 };
}

// =====================================================
// Get Comment Count
// =====================================================

export async function getCommentCount(itemId: string) {
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);

  return count ?? 0;
}

// =====================================================
// Like Comment
// =====================================================

export async function likeComment(commentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("comment_likes")
    .insert({ comment_id: commentId, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 좋아요를 누르셨습니다" };
    }
    return { error: error.message };
  }

  return { success: true };
}

// =====================================================
// Unlike Comment
// =====================================================

export async function unlikeComment(commentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// =====================================================
// Get Comment Like Counts
// =====================================================

export async function getCommentLikeCounts(commentIds: string[]): Promise<Record<string, number>> {
  if (commentIds.length === 0) return {};

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .in("comment_id", commentIds);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const like of data) {
    counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;
  }

  return counts;
}

// =====================================================
// Check Comment Like Status
// =====================================================

export async function checkCommentLikeStatus(commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Set();

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", user.id)
    .in("comment_id", commentIds);

  if (error || !data) return new Set();

  return new Set(data.map(like => like.comment_id));
}
