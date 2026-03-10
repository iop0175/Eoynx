"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

// =====================================================
// Follow / Unfollow
// =====================================================

export async function followUser(targetUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  if (user.id === targetUserId) {
    return { error: "자신을 팔로우할 수 없습니다" };
  }

  const { error } = await supabase
    .from("followers")
    .insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 팔로우하고 있습니다" };
    }
    return { error: error.message };
  }

  // Send notification
  await createNotification({
    userId: targetUserId,
    type: "follow",
    actorId: user.id,
  });

  return { success: true };
}

export async function unfollowUser(targetUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("followers")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function checkIsFollowing(targetUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isFollowing: false };
  }

  const { data } = await supabase
    .from("followers")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  return { isFollowing: !!data };
}

// =====================================================
// Like / Unlike
// =====================================================

export async function likeItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("likes")
    .insert({
      user_id: user.id,
      item_id: itemId,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 좋아요를 눌렀습니다" };
    }
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
      type: "like",
      actorId: user.id,
      itemId,
    });
  }

  return { success: true };
}

export async function unlikeItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("user_id", user.id)
    .eq("item_id", itemId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function checkIsLiked(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isLiked: false };
  }

  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .maybeSingle();

  return { isLiked: !!data };
}

export async function getLikeCount(itemId: string) {
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);

  return count ?? 0;
}

// =====================================================
// Bookmark / Unbookmark
// =====================================================

export async function bookmarkItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: user.id,
      item_id: itemId,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 저장되었습니다" };
    }
    return { error: error.message };
  }

  return { success: true };
}

export async function unbookmarkItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("item_id", itemId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function checkIsBookmarked(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isBookmarked: false };
  }

  const { data } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .maybeSingle();

  return { isBookmarked: !!data };
}

// =====================================================
// Batch check for feed (multiple items)
// =====================================================

export async function checkBatchInteractions(itemIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || itemIds.length === 0) {
    return {
      likes: {} as Record<string, boolean>,
      bookmarks: {} as Record<string, boolean>,
    };
  }

  // Get user's likes
  const { data: userLikes } = await supabase
    .from("likes")
    .select("item_id")
    .eq("user_id", user.id)
    .in("item_id", itemIds);

  // Get user's bookmarks
  const { data: userBookmarks } = await supabase
    .from("bookmarks")
    .select("item_id")
    .eq("user_id", user.id)
    .in("item_id", itemIds);

  const likesMap: Record<string, boolean> = {};
  const bookmarksMap: Record<string, boolean> = {};

  itemIds.forEach((id) => {
    likesMap[id] = false;
    bookmarksMap[id] = false;
  });

  userLikes?.forEach((like) => {
    likesMap[like.item_id] = true;
  });

  userBookmarks?.forEach((bookmark) => {
    bookmarksMap[bookmark.item_id] = true;
  });

  return {
    likes: likesMap,
    bookmarks: bookmarksMap,
  };
}

// =====================================================
// Get like counts for multiple items
// =====================================================

export async function getBatchLikeCounts(itemIds: string[]) {
  if (itemIds.length === 0) return {} as Record<string, number>;

  const supabase = await createSupabaseServerClient();

  // Get all likes for these items
  const { data: likes } = await supabase
    .from("likes")
    .select("item_id")
    .in("item_id", itemIds);

  const countsMap: Record<string, number> = {};
  itemIds.forEach((id) => {
    countsMap[id] = 0;
  });

  likes?.forEach((like) => {
    countsMap[like.item_id] = (countsMap[like.item_id] || 0) + 1;
  });

  return countsMap;
}
