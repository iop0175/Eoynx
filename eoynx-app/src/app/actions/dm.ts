"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

// =====================================================
// Types
// =====================================================

export type DMThread = {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_at: string;
  other_user: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count: number;
};

export type DMMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

export type DMRequest = {
  id: string;
  from_user: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  thread_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

// =====================================================
// Get or Create Thread
// =====================================================

export async function getOrCreateThread(otherUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  if (user.id === otherUserId) {
    return { error: "자신에게 메시지를 보낼 수 없습니다" };
  }

  // Order participants to match constraint
  const [participant1, participant2] = [user.id, otherUserId].sort();

  // Try to find existing thread
  const { data: existingThread } = await supabase
    .from("dm_threads")
    .select("id")
    .eq("participant1_id", participant1)
    .eq("participant2_id", participant2)
    .single();

  if (existingThread) {
    return { success: true, threadId: existingThread.id };
  }

  // Create new thread
  const { data: newThread, error } = await supabase
    .from("dm_threads")
    .insert({
      participant1_id: participant1,
      participant2_id: participant2,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Check if other user is following us (if not, create a request)
  const { data: isFollowing } = await supabase
    .from("followers")
    .select("id")
    .eq("follower_id", otherUserId)
    .eq("following_id", user.id)
    .single();

  if (!isFollowing) {
    // Create DM request for non-followers
    await supabase
      .from("dm_requests")
      .insert({
        from_user_id: user.id,
        to_user_id: otherUserId,
        thread_id: newThread.id,
      });

    // Send notification for DM request
    await createNotification({
      userId: otherUserId,
      type: "dm_request",
      actorId: user.id,
      threadId: newThread.id,
    });
  }

  return { success: true, threadId: newThread.id, isRequest: !isFollowing };
}

// =====================================================
// Send Message
// =====================================================

export async function sendMessage(threadId: string, content: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { error: "메시지 내용을 입력해주세요" };
  }

  if (trimmedContent.length > 2000) {
    return { error: "메시지는 2000자 이하로 입력해주세요" };
  }

  // Get thread to find recipient
  const { data: thread } = await supabase
    .from("dm_threads")
    .select("participant1_id, participant2_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  const recipientId = thread.participant1_id === user.id
    ? thread.participant2_id
    : thread.participant1_id;

  // Insert message
  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      content: trimmedContent,
    })
    .select("id, sender_id, content, created_at")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Update thread's last_message_at
  await supabase
    .from("dm_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  // Send notification to recipient
  await createNotification({
    userId: recipientId,
    type: "dm",
    actorId: user.id,
    threadId,
    preview: trimmedContent.substring(0, 100),
  });

  revalidatePath(`/dm/${threadId}`);
  revalidatePath("/dm");
  return { success: true, message };
}

// =====================================================
// Get Threads (Inbox)
// =====================================================

export async function getThreads() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { threads: [] };
  }

  // Get all threads where user is a participant
  const { data: threads } = await supabase
    .from("dm_threads")
    .select(`
      id,
      participant1_id,
      participant2_id,
      last_message_at
    `)
    .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (!threads || threads.length === 0) {
    return { threads: [] };
  }

  // Get other users' profiles
  const otherUserIds = threads.map((t) =>
    t.participant1_id === user.id ? t.participant2_id : t.participant1_id
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", otherUserIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  // Get last message for each thread
  const threadIds = threads.map((t) => t.id);
  const { data: lastMessages } = await supabase
    .from("dm_messages")
    .select("thread_id, content, sender_id, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  type LastMessage = { thread_id: string; content: string; sender_id: string; created_at: string };
  const lastMessageMap = new Map<string, LastMessage>();
  lastMessages?.forEach((m) => {
    if (!lastMessageMap.has(m.thread_id)) {
      lastMessageMap.set(m.thread_id, m as LastMessage);
    }
  });

  // Get unread counts
  const { data: unreadCounts } = await supabase
    .from("dm_messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const unreadMap = new Map<string, number>();
  unreadCounts?.forEach((m) => {
    unreadMap.set(m.thread_id, (unreadMap.get(m.thread_id) ?? 0) + 1);
  });

  const result: DMThread[] = threads.map((t) => {
    const otherUserId = t.participant1_id === user.id ? t.participant2_id : t.participant1_id;
    const profile = profileMap.get(otherUserId);
    const lastMessage = lastMessageMap.get(t.id);

    return {
      id: t.id,
      participant1_id: t.participant1_id,
      participant2_id: t.participant2_id,
      last_message_at: t.last_message_at,
      other_user: {
        id: otherUserId,
        handle: profile?.handle ?? "unknown",
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      last_message: lastMessage
        ? {
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at,
          }
        : undefined,
      unread_count: unreadMap.get(t.id) ?? 0,
    };
  });

  return { threads: result };
}

// =====================================================
// Get Messages for Thread
// =====================================================

export async function getMessages(threadId: string, limit = 50, offset = 0) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { messages: [] };
  }

  const { data: messages, error } = await supabase
    .from("dm_messages")
    .select("id, thread_id, sender_id, content, read_at, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { messages: [] };
  }

  // Mark messages as read
  await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return { messages: (messages ?? []).reverse() as DMMessage[] };
}

// =====================================================
// Get Thread Details
// =====================================================

export async function getThreadDetails(threadId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { data: thread } = await supabase
    .from("dm_threads")
    .select("id, participant1_id, participant2_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  // Check if user is participant
  if (thread.participant1_id !== user.id && thread.participant2_id !== user.id) {
    return { error: "접근 권한이 없습니다" };
  }

  const otherUserId = thread.participant1_id === user.id 
    ? thread.participant2_id 
    : thread.participant1_id;

  const { data: otherUser } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .eq("id", otherUserId)
    .single();

  return {
    success: true,
    thread,
    otherUser: otherUser ?? { id: otherUserId, handle: "unknown", display_name: null, avatar_url: null },
    currentUserId: user.id,
  };
}

// =====================================================
// Get DM Requests
// =====================================================

export async function getDMRequests() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { requests: [] };
  }

  const { data: requests } = await supabase
    .from("dm_requests")
    .select("id, from_user_id, thread_id, status, created_at")
    .eq("to_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!requests || requests.length === 0) {
    return { requests: [] };
  }

  // Get profiles of requesters
  const fromUserIds = requests.map((r) => r.from_user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", fromUserIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const result: DMRequest[] = requests.map((r) => {
    const profile = profileMap.get(r.from_user_id);
    return {
      id: r.id,
      from_user: {
        id: r.from_user_id,
        handle: profile?.handle ?? "unknown",
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      thread_id: r.thread_id,
      status: r.status as "pending" | "accepted" | "declined",
      created_at: r.created_at,
    };
  });

  return { requests: result };
}

// =====================================================
// Accept/Decline DM Request
// =====================================================

export async function respondToDMRequest(requestId: string, accept: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("dm_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", requestId)
    .eq("to_user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dm/requests");
  revalidatePath("/dm");
  return { success: true };
}

// =====================================================
// Get Unread Count
// =====================================================

export async function getUnreadCount() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  // Get threads where user is participant
  const { data: threads } = await supabase
    .from("dm_threads")
    .select("id")
    .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

  if (!threads || threads.length === 0) {
    return 0;
  }

  const threadIds = threads.map((t) => t.id);

  const { count } = await supabase
    .from("dm_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", threadIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}
