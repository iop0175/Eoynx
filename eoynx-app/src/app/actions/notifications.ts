"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =====================================================
// Types
// =====================================================

export type NotificationType = "follow" | "like" | "comment" | "dm" | "dm_request";

export type Notification = {
  id: string;
  type: NotificationType;
  actor: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  item?: {
    id: string;
    title: string;
    image_url: string | null;
  } | null;
  preview?: string | null;
  thread_id?: string | null;
  read_at: string | null;
  created_at: string;
};

async function sendExpoPush({
  to,
  title,
  body,
  data,
}: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string | null | undefined>;
}) {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        sound: "default",
        title,
        body,
        data,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Expo push failed:", res.status, payload);
    }
  } catch (error) {
    console.error("Expo push request error:", error);
  }
}

// =====================================================
// Create Notification (Internal helper)
// =====================================================

export async function createNotification({
  userId,
  type,
  actorId,
  itemId,
  commentId,
  threadId,
  preview,
}: {
  userId: string;
  type: NotificationType;
  actorId?: string;
  itemId?: string;
  commentId?: string;
  threadId?: string;
  preview?: string;
}) {
  const supabase = await createSupabaseServerClient();

  // Don't notify yourself
  if (actorId && actorId === userId) {
    return { success: true };
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    actor_id: actorId,
    item_id: itemId,
    comment_id: commentId,
    thread_id: threadId,
    preview,
  });

  if (error) {
    console.error("Failed to create notification:", error);
    return { error: error.message };
  }

  // Try to send mobile push notification when recipient has Expo token.
  const [{ data: recipientProfile }, { data: actorProfile }] = await Promise.all([
    supabase.from("profiles").select("expo_push_token").eq("id", userId).maybeSingle(),
    actorId
      ? supabase.from("profiles").select("handle,display_name").eq("id", actorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const expoPushToken = recipientProfile?.expo_push_token ?? null;
  if (expoPushToken) {
    const actorName = actorProfile?.display_name ?? actorProfile?.handle ?? "Someone";
    let body = "You have a new notification";
    if (type === "follow") body = `${actorName} followed you`;
    if (type === "like") body = `${actorName} liked your item`;
    if (type === "comment") body = `${actorName} commented on your item`;
    if (type === "dm") body = preview?.trim() ? preview : `${actorName} sent you a message`;
    if (type === "dm_request") body = `${actorName} sent a DM request`;

    await sendExpoPush({
      to: expoPushToken,
      title: "EOYNX",
      body,
      data: {
        type,
        threadId: threadId ?? null,
        itemId: itemId ?? null,
        actorId: actorId ?? null,
        actorHandle: actorProfile?.handle ?? null,
      },
    });
  }

  return { success: true };
}

// =====================================================
// Get Notifications
// =====================================================

export async function getNotifications(limit = 20, offset = 0) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [] };
  }

  // Get notifications
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, type, actor_id, item_id, thread_id, preview, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !notifications) {
    return { notifications: [] };
  }

  // Get unique actor IDs and item IDs
  const actorIds = [...new Set(notifications.map((n) => n.actor_id).filter(Boolean))];
  const itemIds = [...new Set(notifications.map((n) => n.item_id).filter(Boolean))];

  // Fetch actors
  const { data: actors } = actorIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", actorIds)
    : { data: [] };

  const actorMap = new Map(actors?.map((a) => [a.id, a]) ?? []);

  // Fetch items
  const { data: items } = itemIds.length > 0
    ? await supabase
        .from("items")
        .select("id, title, image_url")
        .in("id", itemIds)
    : { data: [] };

  const itemMap = new Map(items?.map((i) => [i.id, i]) ?? []);

  // Map to result type
  const result: Notification[] = notifications.map((n) => ({
    id: n.id,
    type: n.type as NotificationType,
    actor: n.actor_id ? actorMap.get(n.actor_id) ?? null : null,
    item: n.item_id ? itemMap.get(n.item_id) ?? null : null,
    preview: n.preview,
    thread_id: n.thread_id,
    read_at: n.read_at,
    created_at: n.created_at,
  }));

  return { notifications: result };
}

// =====================================================
// Get Unread Count
// =====================================================

export async function getUnreadNotificationCount() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}

// =====================================================
// Mark as Read
// =====================================================

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}

// =====================================================
// Mark All as Read
// =====================================================

export async function markAllNotificationsAsRead() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}

// =====================================================
// Delete Notification
// =====================================================

export async function deleteNotification(notificationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}

// =====================================================
// Clear All Notifications
// =====================================================

export async function clearAllNotifications() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}
