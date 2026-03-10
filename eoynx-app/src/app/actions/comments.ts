"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

// =====================================================
// Add Comment
// =====================================================

export async function addComment(itemId: string, content: string) {
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

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      item_id: itemId,
      user_id: user.id,
      content: trimmedContent,
    })
    .select("id, content, created_at")
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

  const { error } = await supabase
    .from("comments")
    .update({ content: trimmedContent })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

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

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/i/${itemId}`);
  return { success: true };
}

// =====================================================
// Get Comments for Item
// =====================================================

export type CommentWithUser = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
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
    .select("id, content, created_at, user_id, profiles(handle, display_name, avatar_url)", { count: "exact" })
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
