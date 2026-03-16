"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";
import { generateDMRoomKey } from "@/lib/dmCrypto";
import { constants, createPublicKey, publicEncrypt } from "crypto";

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
    image_url?: string | null;
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

function encryptRoomKeyForProfilePublicKey(publicKeyJwk: string, roomKeyBase64: string): string {
  const keyObject = createPublicKey({ key: JSON.parse(publicKeyJwk), format: "jwk" });
  const encrypted = publicEncrypt(
    {
      key: keyObject,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(roomKeyBase64, "base64")
  );
  return encrypted.toString("base64");
}

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
    const roomKey = generateDMRoomKey();

    const { data: participantProfiles } = await supabase
      .from("profiles")
      .select("id, encryption_public_key")
      .in("id", [participant1, participant2]);

    const p1 = participantProfiles?.find((p) => p.id === participant1);
    const p2 = participantProfiles?.find((p) => p.id === participant2);

    const canUseEncryptedKeys = Boolean(p1?.encryption_public_key && p2?.encryption_public_key);
    if (!canUseEncryptedKeys) {
      return { error: "상대방 또는 내 암호화 키가 준비되지 않았습니다. 잠시 후 다시 시도해주세요" };
    }

    const encryptedKeyForP1 = encryptRoomKeyForProfilePublicKey(p1!.encryption_public_key, roomKey);
    const encryptedKeyForP2 = encryptRoomKeyForProfilePublicKey(p2!.encryption_public_key, roomKey);
    
    const { data: newThread, error } = await supabase
      .from("dm_threads")
      .insert({
        participant1_id: participant1,
        participant2_id: participant2,
        encrypted_key_for_p1: encryptedKeyForP1,
        encrypted_key_for_p2: encryptedKeyForP2,
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

  console.log("[dm/sendMessage] start", {
    threadId,
    hasText: Boolean(content.trim()),
    hasEncryptedData: Boolean(encryptedData),
    hasImage: Boolean(imageUrl),
    userId: user?.id ?? null,
  });

  if (!user) {
    console.log("[dm/sendMessage] blocked:not-authenticated", { threadId });
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
    console.log("[dm/sendMessage] blocked:thread-not-found", { threadId, userId: user.id });
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
    console.log("[dm/sendMessage] blocked:pending-request", { threadId, userId: user.id });
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
      .select("id, status")
      .eq("from_user_id", user.id)
      .eq("to_user_id", recipientId)
      .maybeSingle();

    if (!requestStatus) {
      await supabase
        .from("dm_requests")
        .insert({
          from_user_id: user.id,
          to_user_id: recipientId,
          thread_id: threadId,
          status: "pending",
        });

      await createNotification({
        userId: recipientId,
        type: "dm_request",
        actorId: user.id,
        threadId,
      });

      console.log("[dm/sendMessage] created:request-pending", { threadId, userId: user.id });
      return { error: "상대방에게 DM 요청을 보냈습니다. 수락 후 메시지를 보낼 수 있습니다" };
    }

    if (requestStatus?.status === "declined" && requestStatus.id) {
      await supabase
        .from("dm_requests")
        .update({ status: "pending", thread_id: threadId })
        .eq("id", requestStatus.id);

      await createNotification({
        userId: recipientId,
        type: "dm_request",
        actorId: user.id,
        threadId,
      });

      console.log("[dm/sendMessage] updated:request-repending", { threadId, userId: user.id });
      return { error: "상대방에게 DM 요청을 다시 보냈습니다. 수락 후 메시지를 보낼 수 있습니다" };
    }

    if (requestStatus?.status !== "accepted") {
      console.log("[dm/sendMessage] blocked:recipient-closed", { threadId, userId: user.id });
      return { error: "상대방이 DM 요청을 수락해야 메시지를 보낼 수 있습니다" };
    }
  }

  // Insert message (content 컬럼 삭제됨, encrypted_content만 사용)
  // 텍스트가 있을 때만 암호화 payload가 필요하다.
  const hasText = Boolean(trimmedContent);
  if (hasText && !encryptedData) {
    console.log("[dm/sendMessage] blocked:missing-encrypted-data", { threadId, userId: user.id });
    return { error: "암호화 키 준비 중입니다. 잠시 후 다시 시도해주세요" };
  }

  const encryptedContent = hasText ? (encryptedData?.encryptedContent ?? null) : null;
  const iv = hasText ? (encryptedData?.iv ?? null) : null;
  
  const insertData = {
    thread_id: threadId,
    sender_id: user.id,
    encrypted_content: encryptedContent,
    encrypted_key: encryptedData?.encryptedKey ?? null,
    iv: iv,
    is_encrypted: hasText,
    image_url: imageUrl ?? null,
  };

  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert(insertData)
    .select("id, sender_id, created_at, encrypted_content, encrypted_key, iv, is_encrypted, image_url")
    .single();

  if (error) {
    console.log("[dm/sendMessage] failed:insert", { threadId, userId: user.id, error: error.message });
    return { error: error.message };
  }

  console.log("[dm/sendMessage] success", { threadId, userId: user.id, messageId: message.id });

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
    preview: imageUrl
      ? "Photo"
      : trimmedContent
        ? trimmedContent.slice(0, 120)
        : "Message",
  });

  // 실시간 구독으로 메시지/인박스를 반영하므로 전송마다 라우트 전체 revalidate는 생략한다.
  
  // 클라이언트에 복호화된 content로 반환
  return { 
    success: true, 
    message: { ...message, content: "" } 
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
    .select("thread_id, sender_id, created_at, encrypted_content, iv, image_url")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  type LastMessage = {
    thread_id: string;
    sender_id: string;
    created_at: string;
    encrypted_content?: string;
    iv?: string;
    image_url?: string | null;
  };
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

  // Use latest DM notification preview as a readable fallback for encrypted messages.
  const { data: dmNotificationRows } = await supabase
    .from("notifications")
    .select("thread_id, preview, created_at")
    .eq("user_id", user.id)
    .eq("type", "dm")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  const dmPreviewMap = new Map<string, string>();
  dmNotificationRows?.forEach((row) => {
    const threadId = row.thread_id as string | null;
    const preview = row.preview?.trim();
    if (!threadId || !preview) return;
    if (!dmPreviewMap.has(threadId)) {
      dmPreviewMap.set(threadId, preview);
    }
  });

  const unreadMap = new Map<string, number>();
  unreadCounts?.forEach((m) => {
    unreadMap.set(m.thread_id, (unreadMap.get(m.thread_id) ?? 0) + 1);
  });

  const result: DMThread[] = activeThreads.map((t) => {
    const otherUserId = t.participant1_id === user.id ? t.participant2_id : t.participant1_id;
    const profile = profileMap.get(otherUserId);
    const lastMessage = lastMessageMap.get(t.id);

    // 안전한 미리보기 텍스트를 유지한다.
    let displayContent = "";
    if (lastMessage?.encrypted_content) {
      displayContent = dmPreviewMap.get(t.id) ?? "Encrypted message";
    } else if (lastMessage?.image_url) {
      displayContent = "Photo";
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
            image_url: lastMessage.image_url ?? null,
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

export async function getMessages(threadId: string, limit = 20, offset = 0) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { messages: [] };
  }

  const { data: messages, error } = await supabase
    .from("dm_messages")
    .select("id, thread_id, sender_id, read_at, created_at, encrypted_content, encrypted_key, iv, is_encrypted, image_url")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { messages: [] };
  }

  // 암호문을 그대로 전달한다.
  const decryptedMessages = (messages ?? []).map((m) => {
    const content = "";
    
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
    .select("id, participant1_id, participant2_id, encrypted_key_for_p1, encrypted_key_for_p2")
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

  let myEncryptedKey = isParticipant1
    ? thread.encrypted_key_for_p1
    : thread.encrypted_key_for_p2;

  if (!myEncryptedKey) {
    const { data: participantProfiles } = await supabase
      .from("profiles")
      .select("id, encryption_public_key")
      .in("id", [thread.participant1_id, thread.participant2_id]);

    const p1 = participantProfiles?.find((p) => p.id === thread.participant1_id);
    const p2 = participantProfiles?.find((p) => p.id === thread.participant2_id);

    if (p1?.encryption_public_key && p2?.encryption_public_key) {
      try {
        const roomKey = generateDMRoomKey();
        const encryptedKeyForP1 = encryptRoomKeyForProfilePublicKey(p1.encryption_public_key, roomKey);
        const encryptedKeyForP2 = encryptRoomKeyForProfilePublicKey(p2.encryption_public_key, roomKey);

        await supabase
          .from("dm_threads")
          .update({
            encrypted_key_for_p1: encryptedKeyForP1,
            encrypted_key_for_p2: encryptedKeyForP2,
          })
          .eq("id", threadId);

        myEncryptedKey = isParticipant1 ? encryptedKeyForP1 : encryptedKeyForP2;
      } catch {
        // Keep null and let client show key-preparation state.
      }
    }
  }

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

  const canSend = !pendingRequest;

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
    roomKey: null,
    canSend,
    otherUserPublicKey: otherUser?.encryption_public_key ?? null,
  };
}

// =====================================================
// Rotate Thread Room Key (Key mismatch recovery)
// =====================================================

export async function rotateThreadRoomKey(threadId: string) {
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

  const isParticipant1 = thread.participant1_id === user.id;
  const isParticipant2 = thread.participant2_id === user.id;
  if (!isParticipant1 && !isParticipant2) {
    return { error: "접근 권한이 없습니다" };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, encryption_public_key")
    .in("id", [thread.participant1_id, thread.participant2_id]);

  const p1 = profiles?.find((p) => p.id === thread.participant1_id);
  const p2 = profiles?.find((p) => p.id === thread.participant2_id);

  if (!p1?.encryption_public_key || !p2?.encryption_public_key) {
    return { error: "참여자 암호화 키가 아직 준비되지 않았습니다" };
  }

  const roomKey = generateDMRoomKey();
  const encryptedKeyForP1 = encryptRoomKeyForProfilePublicKey(p1.encryption_public_key, roomKey);
  const encryptedKeyForP2 = encryptRoomKeyForProfilePublicKey(p2.encryption_public_key, roomKey);

  const { error: updateError } = await supabase
    .from("dm_threads")
    .update({
      encrypted_key_for_p1: encryptedKeyForP1,
      encrypted_key_for_p2: encryptedKeyForP2,
    })
    .eq("id", threadId);

  if (updateError) {
    return { error: updateError.message };
  }

  return {
    success: true,
    myEncryptedRoomKey: isParticipant1 ? encryptedKeyForP1 : encryptedKeyForP2,
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
