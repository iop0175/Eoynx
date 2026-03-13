"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReportReason } from "@/lib/constants/safety";

// =====================================================
// Report User
// =====================================================

export async function reportUser(
  userId: string,
  reason: ReportReason,
  description?: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  if (user.id === userId) {
    return { error: "자기 자신을 신고할 수 없습니다" };
  }

  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_user_id: userId,
      reason,
      description,
    });

  if (error) {
    console.error("Failed to report user:", error);
    return { error: "신고 처리 중 오류가 발생했습니다" };
  }

  return { success: true };
}

// =====================================================
// Report Item
// =====================================================

export async function reportItem(
  itemId: string,
  reason: ReportReason,
  description?: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_item_id: itemId,
      reason,
      description,
    });

  if (error) {
    console.error("Failed to report item:", error);
    return { error: "신고 처리 중 오류가 발생했습니다" };
  }

  return { success: true };
}

// =====================================================
// Report Comment
// =====================================================

export async function reportComment(
  commentId: string,
  reason: ReportReason,
  description?: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_comment_id: commentId,
      reason,
      description,
    });

  if (error) {
    console.error("Failed to report comment:", error);
    return { error: "신고 처리 중 오류가 발생했습니다" };
  }

  return { success: true };
}

// =====================================================
// Block User
// =====================================================

export async function blockUser(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  if (user.id === userId) {
    return { error: "자기 자신을 차단할 수 없습니다" };
  }

  // Remove any follow relationships
  await Promise.all([
    supabase.from("followers").delete()
      .eq("follower_id", user.id)
      .eq("following_id", userId),
    supabase.from("followers").delete()
      .eq("follower_id", userId)
      .eq("following_id", user.id),
  ]);

  const { error } = await supabase
    .from("blocks")
    .insert({
      blocker_id: user.id,
      blocked_id: userId,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 차단된 사용자입니다" };
    }
    console.error("Failed to block user:", error);
    return { error: "차단 처리 중 오류가 발생했습니다" };
  }

  return { success: true };
}

// =====================================================
// Unblock User
// =====================================================

export async function unblockUser(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId);

  if (error) {
    console.error("Failed to unblock user:", error);
    return { error: "차단 해제 중 오류가 발생했습니다" };
  }

  return { success: true };
}

// =====================================================
// Check if User is Blocked
// =====================================================

export async function checkIsBlocked(userId: string): Promise<{ isBlocked: boolean; isBlockedBy: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isBlocked: false, isBlockedBy: false };
  }

  const [{ data: blockedByMe }, { data: blockedByThem }] = await Promise.all([
    supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", userId)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", user.id)
      .maybeSingle(),
  ]);

  return {
    isBlocked: !!blockedByMe,
    isBlockedBy: !!blockedByThem,
  };
}

// =====================================================
// Get Blocked Users List
// =====================================================

export async function getBlockedUsers() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { blockedUsers: [] };
  }

  const { data, error } = await supabase
    .from("blocks")
    .select(`
      blocked_id,
      created_at,
      profiles:blocked_id(handle, display_name, avatar_url)
    `)
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get blocked users:", error);
    return { blockedUsers: [] };
  }

  return {
    blockedUsers: data.map((block) => ({
      id: block.blocked_id,
      createdAt: block.created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(block.profiles as any),
    })),
  };
}
