"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";
import { decryptDMContent, encryptDMContent, generateDMRoomKey } from "@/lib/dmCrypto";

// =====================================================
// Utility: Generate Room Key (Server-side)
// =====================================================

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
  // E2E 암호화 필드
  encrypted_content?: string | null;
  encrypted_key?: string | null;
  iv?: string | null;
  is_encrypted?: boolean;
  // 이미지 첨부
  image_url?: string | null;
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
// Set Room Encryption Key
// =====================================================

interface SetRoomKeyParams {
  threadId: string;
  encryptedKeyForP1: string;
  encryptedKeyForP2: string;
}

export async function setRoomEncryptionKey({
  threadId,
  encryptedKeyForP1,
  encryptedKeyForP2,
}: SetRoomKeyParams) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  // Verify user is participant
  const { data: thread } = await supabase
    .from("dm_threads")
    .select("participant1_id, participant2_id, encrypted_key_for_p1")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  const isParticipant = thread.participant1_id === user.id || thread.participant2_id === user.id;
  if (!isParticipant) {
    return { error: "이 대화의 참가자가 아닙니다" };
  }

  // Don't overwrite if already set
  if (thread.encrypted_key_for_p1) {
    return { success: true }; // Key already exists
  }

  const { error } = await supabase
    .from("dm_threads")
    .update({
      encrypted_key_for_p1: encryptedKeyForP1,
      encrypted_key_for_p2: encryptedKeyForP2,
    })
    .eq("id", threadId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

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

  let finalThreadId = existingThread?.id ?? null;
  if (!finalThreadId) {
    // 채팅방 생성 시 room_key 자동 생성
    const roomKey = generateDMRoomKey();
    
    const { data: newThread, error } = await supabase
      .from("dm_threads")
      .insert({
        participant1_id: participant1,
        participant2_id: participant2,
        room_key: roomKey,
      })
      .select("id")
      .single();

    if (error) {
      return { error: error.message };
    }

    finalThreadId = newThread.id;
  }

  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("dm_open")
    .eq("id", otherUserId)
    .maybeSingle();

  const recipientOpen = recipientProfile?.dm_open ?? true;

  if (recipientOpen) {
    return { success: true, threadId: finalThreadId, isRequest: false };
  }

  const { data: existingRequest } = await supabase
    .from("dm_requests")
    .select("id, status")
    .eq("from_user_id", user.id)
    .eq("to_user_id", otherUserId)
    .maybeSingle();

  if (existingRequest?.status === "accepted") {
    return { success: true, threadId: finalThreadId, isRequest: false };
  }

  if (existingRequest?.id) {
    await supabase
      .from("dm_requests")
      .update({ status: "pending", thread_id: finalThreadId })
      .eq("id", existingRequest.id);
  } else {
    await supabase
      .from("dm_requests")
      .insert({
        from_user_id: user.id,
        to_user_id: otherUserId,
        thread_id: finalThreadId,
      });
  }

  // Send notification for DM request
  await createNotification({
    userId: otherUserId,
    type: "dm_request",
    actorId: user.id,
    threadId: finalThreadId,
  });

  return { success: true, threadId: finalThreadId, isRequest: true };
}

// =====================================================
// Send Message
// =====================================================

interface EncryptedMessageData {
  encryptedContent: string;  // Base64 암호화된 메시지
  encryptedKey: string;      // Base64 암호화된 AES 키
  iv: string;                // Base64 IV
}

export async function sendMessage(
  threadId: string, 
  content: string,
  encryptedData?: EncryptedMessageData,
  imageUrl?: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const trimmedContent = content.trim();
  if (!trimmedContent && !encryptedData && !imageUrl) {
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

  // If there is a pending DM request between participants, block sending until accepted.
  const { data: pendingRequest } = await supabase
    .from("dm_requests")
    .select("id")
    .eq("status", "pending")
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${recipientId}),and(from_user_id.eq.${recipientId},to_user_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle();

  if (pendingRequest) {
    return { error: "상대방이 DM 요청을 수락해야 메시지를 보낼 수 있습니다" };
  }

  // Recipient can require request-accept flow.
  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("dm_open")
    .eq("id", recipientId)
    .maybeSingle();

  const recipientOpen = recipientProfile?.dm_open ?? true;
  if (!recipientOpen) {
    const { data: requestStatus } = await supabase
      .from("dm_requests")
      .select("status")
      .eq("from_user_id", user.id)
      .eq("to_user_id", recipientId)
      .maybeSingle();

    if (requestStatus?.status !== "accepted") {
      return { error: "상대방이 DM 요청을 수락해야 메시지를 보낼 수 있습니다" };
    }
  }

  // Insert message (content 컬럼 삭제됨, encrypted_content만 사용)
  // 암호화 안된 경우에도 encrypted_content에 저장 (서버에서 암호화)
  let encryptedContent = encryptedData?.encryptedContent;
  let iv = encryptedData?.iv;
  
  if (!encryptedData) {
    // 암호화 안된 경우: 서버에서 암호화하여 저장 (room_key 필요)
    const { data: thread } = await supabase
      .from("dm_threads")
      .select("room_key")
      .eq("id", threadId)
      .single();
    
    if (thread?.room_key) {
      const encrypted = encryptDMContent(thread.room_key, trimmedContent);
      encryptedContent = encrypted.encryptedContent;
      iv = encrypted.iv;
    }
  }
  
  const insertData = {
    thread_id: threadId,
    sender_id: user.id,
    encrypted_content: encryptedContent,
    encrypted_key: encryptedData?.encryptedKey ?? null,
    iv: iv,
    is_encrypted: true,
    image_url: imageUrl ?? null,
  };

  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert(insertData)
    .select("id, sender_id, created_at, encrypted_content, encrypted_key, iv, is_encrypted, image_url")
    .single();

  if (error) {
    return { error: error.message };
  }

  // 복호화된 content 생성 (클라이언트 반환용)
  let returnContent = "";
  if (message.encrypted_content && message.iv) {
    const { data: thread } = await supabase
      .from("dm_threads")
      .select("room_key")
      .eq("id", threadId)
      .single();
    
    if (thread?.room_key) {
      returnContent = decryptDMContent(thread.room_key, message.encrypted_content, message.iv);
    }
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
    preview: returnContent?.trim() ? returnContent : imageUrl ? "Photo" : "New message",
  });

  revalidatePath(`/dm/${threadId}`);
  revalidatePath("/dm");
  
  // 클라이언트에 복호화된 content로 반환
  return { 
    success: true, 
    message: { ...message, content: returnContent } 
  };
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

  // Get all threads where user is a participant (and not left)
  const { data: threads } = await supabase
    .from("dm_threads")
    .select(`
      id,
      participant1_id,
      participant2_id,
      participant1_left_at,
      participant2_left_at,
      last_message_at
    `)
    .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (!threads || threads.length === 0) {
    return { threads: [] };
  }

  // Filter out threads where user has left
  const activeThreads = threads.filter((t) => {
    if (t.participant1_id === user.id && t.participant1_left_at) {
      return false;
    }
    if (t.participant2_id === user.id && t.participant2_left_at) {
      return false;
    }
    return true;
  });

  if (activeThreads.length === 0) {
    return { threads: [] };
  }

  // Get other users' profiles
  const otherUserIds = activeThreads.map((t) =>
    t.participant1_id === user.id ? t.participant2_id : t.participant1_id
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", otherUserIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  // Get last message for each thread (content 컬럼 삭제됨)
  const threadIds = activeThreads.map((t) => t.id);
  const { data: lastMessages } = await supabase
    .from("dm_messages")
    .select("thread_id, sender_id, created_at, encrypted_content, iv")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  type LastMessage = { thread_id: string; sender_id: string; created_at: string; encrypted_content?: string; iv?: string };
  const lastMessageMap = new Map<string, LastMessage>();
  lastMessages?.forEach((m) => {
    if (!lastMessageMap.has(m.thread_id)) {
      lastMessageMap.set(m.thread_id, m as LastMessage);
    }
  });

  // Get thread room_keys for decryption
  const { data: threadKeys } = await supabase
    .from("dm_threads")
    .select("id, room_key")
    .in("id", threadIds);
  
  const roomKeyMap = new Map<string, string | null>();
  threadKeys?.forEach((t) => {
    roomKeyMap.set(t.id, t.room_key);
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

  const result: DMThread[] = activeThreads.map((t) => {
    const otherUserId = t.participant1_id === user.id ? t.participant2_id : t.participant1_id;
    const profile = profileMap.get(otherUserId);
    const lastMessage = lastMessageMap.get(t.id);
    const roomKey = roomKeyMap.get(t.id);

    // Decrypt last message (항상 encrypted_content에서 복호화)
    let displayContent = "";
    if (lastMessage?.encrypted_content && lastMessage.iv && roomKey) {
      displayContent = decryptDMContent(roomKey, lastMessage.encrypted_content, lastMessage.iv);
    }

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
            content: displayContent,
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

  // Get thread room_key for decryption
  const { data: thread } = await supabase
    .from("dm_threads")
    .select("room_key")
    .eq("id", threadId)
    .single();

  const roomKey = thread?.room_key;

  const { data: messages, error } = await supabase
    .from("dm_messages")
    .select("id, thread_id, sender_id, read_at, created_at, encrypted_content, encrypted_key, iv, is_encrypted, image_url")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { messages: [] };
  }

  // Decrypt messages server-side and generate public URLs for images
  const decryptedMessages = (messages ?? []).map((m) => {
    let content = "";
    if (m.encrypted_content && m.iv && roomKey) {
      content = decryptDMContent(roomKey, m.encrypted_content, m.iv);
    }
    
    // image_url이 경로인 경우 public URL 생성
    let imageUrl = m.image_url;
    if (imageUrl && !imageUrl.startsWith("http")) {
      // 경로만 저장된 경우 public URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from("dm-attachments")
        .getPublicUrl(imageUrl);
      imageUrl = publicUrl;
    }
    
    return {
      ...m,
      content,
      image_url: imageUrl,
    };
  });

  // Mark messages as read
  const { data: updatedRows, error: markReadError } = await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_id", user.id)
    .is("read_at", null)
    .select("id");

  if (markReadError) {
    console.error("Failed to mark DM messages as read:", markReadError);
  } else if (updatedRows && updatedRows.length > 0) {
    // no-op: this function can run during render, so avoid revalidatePath here
  }

  return { messages: decryptedMessages.reverse() as DMMessage[] };
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
    .select("id, participant1_id, participant2_id, encrypted_key_for_p1, encrypted_key_for_p2, room_key")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  // Check if user is participant
  if (thread.participant1_id !== user.id && thread.participant2_id !== user.id) {
    return { error: "접근 권한이 없습니다" };
  }

  const isParticipant1 = thread.participant1_id === user.id;
  const otherUserId = isParticipant1 
    ? thread.participant2_id 
    : thread.participant1_id;

  // 현재 사용자에게 맞는 암호화 키 반환
  const myEncryptedKey = isParticipant1 
    ? thread.encrypted_key_for_p1 
    : thread.encrypted_key_for_p2;

  const { data: otherUser } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, encryption_public_key")
    .eq("id", otherUserId)
    .single();

  const { data: pendingRequest } = await supabase
    .from("dm_requests")
    .select("id")
    .eq("status", "pending")
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle();

  return {
    success: true,
    thread: {
      id: thread.id,
      participant1_id: thread.participant1_id,
      participant2_id: thread.participant2_id,
    },
    otherUser: otherUser ?? { id: otherUserId, handle: "unknown", display_name: null, avatar_url: null, encryption_public_key: null },
    currentUserId: user.id,
    isParticipant1,
    myEncryptedRoomKey: myEncryptedKey ?? null,
    roomKey: thread.room_key ?? null, // 평문 room key
    canSend: !pendingRequest,
    otherUserPublicKey: otherUser?.encryption_public_key ?? null,
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

// =====================================================
// Leave Thread (DM 나가기 - 스레드 삭제)
// =====================================================

export async function leaveThread(threadId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  // Get thread to verify user is a participant
  const { data: thread, error: fetchError } = await supabase
    .from("dm_threads")
    .select("participant1_id, participant2_id")
    .eq("id", threadId)
    .single();

  if (fetchError || !thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  const isParticipant = thread.participant1_id === user.id || thread.participant2_id === user.id;

  if (!isParticipant) {
    return { error: "이 대화의 참가자가 아닙니다" };
  }

  // Delete thread (CASCADE will delete messages)
  const { error: deleteError } = await supabase
    .from("dm_threads")
    .delete()
    .eq("id", threadId);

  if (deleteError) {
    console.error("Error deleting thread:", deleteError);
    return { error: deleteError.message };
  }

  revalidatePath("/dm");
  return { success: true };
}

// =====================================================
// Upload DM Image
// =====================================================

export async function uploadDMImage(threadId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  // Verify user is participant
  const { data: thread } = await supabase
    .from("dm_threads")
    .select("participant1_id, participant2_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return { error: "스레드를 찾을 수 없습니다" };
  }

  const isParticipant = thread.participant1_id === user.id || thread.participant2_id === user.id;
  if (!isParticipant) {
    return { error: "이 대화의 참가자가 아닙니다" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "파일이 없습니다" };
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "지원하지 않는 파일 형식입니다 (JPEG, PNG, GIF, WebP만 허용)" };
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return { error: "파일 크기는 5MB 이하여야 합니다" };
  }

  // Generate unique filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${threadId}/${user.id}/${Date.now()}.${ext}`;

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("dm-attachments")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { error: "업로드에 실패했습니다" };
  }

  // 경로만 DB에 저장하지만, 클라이언트 표시용 public URL도 반환
  const { data: { publicUrl } } = supabase.storage
    .from("dm-attachments")
    .getPublicUrl(uploadData.path);

  return { 
    success: true, 
    imagePath: uploadData.path,  // DB 저장용 경로
    imageUrl: publicUrl  // 클라이언트 표시용
  };
}
