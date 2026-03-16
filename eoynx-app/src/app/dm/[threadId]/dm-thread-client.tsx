"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, Lock, LogOut, MoreVertical, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/optimized-image";
import { PageShell } from "@/components/page-shell";
import { sendMessage, leaveThread, uploadDMImage, rotateThreadRoomKey } from "@/app/actions/dm";
import {
  decryptRoomKey,
  encryptWithRoomKey,
  loadPrivateKey,
  importRoomKey,
} from "@/lib/crypto";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { decryptWithRoomKey as decryptWithRoomKeyClient } from "@/lib/crypto";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_pending?: boolean;
  decrypt_failed?: boolean;
  decrypted_checked?: boolean;
  // E2E 암호화 필드 (서버에서 복호화 후 전달됨)
  is_encrypted?: boolean;
  encrypted_content?: string | null;
  iv?: string | null;
  // 이미지 첨부
  image_url?: string | null;
}

interface OtherUser {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

interface DMThreadClientProps {
  threadId: string;
  otherUser: OtherUser;
  initialMessages: Message[];
  currentUserId: string;
  canSend: boolean;
  myEncryptedRoomKey: string | null;
  roomKeyBase64: string | null; // 평문 room key (Base64)
}

const ENABLE_DM_REALTIME = true;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

type SharedItemPreview = {
  id: string;
  title: string;
  image_url: string | null;
  brand: string | null;
  category: string | null;
};

function parseSharedItemMessage(raw: string) {
  const normalized = raw.trim();
  const match =
    normalized.match(/^피드를 공유했습니다\n(.+)\n(https?:\/\/[^\s]+\/i\/[a-f0-9-]+)$/i) ??
    normalized.match(/^📦\s+(.+)\n(https?:\/\/[^\s]+\/i\/[a-f0-9-]+)$/i);
  if (!match) return null;

  let path = "";
  let itemId = "";
  try {
    const parsed = new URL(match[2].trim());
    path = parsed.pathname;
    const idMatch = path.match(/^\/i\/([a-f0-9-]+)$/i);
    itemId = idMatch?.[1] ?? "";
  } catch {
    // Keep fallback values empty when URL parsing fails.
  }

  return {
    title: match[1].trim(),
    url: match[2].trim(),
    path,
    itemId,
  };
}

export function DMThreadClient({
  threadId,
  otherUser,
  initialMessages,
  currentUserId,
  canSend,
  myEncryptedRoomKey,
  roomKeyBase64,
}: DMThreadClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewIncoming, setHasNewIncoming] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{ content: string; image: File | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 메뉴 상태
  const [showMenu, setShowMenu] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // 이미지 업로드 상태
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // 방 키 암호화 상태 (전송용)
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [sharedItemPreviews, setSharedItemPreviews] = useState<Record<string, SharedItemPreview>>({});

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // 대화 나가기 핸들러
  const handleLeave = async () => {
    if (!confirm("대화방을 나가시겠습니까? 메시지 기록이 더 이상 표시되지 않습니다.")) {
      return;
    }
    
    setIsLeaving(true);
    const result = await leaveThread(threadId);
    
    if (result.error) {
      alert(result.error);
      setIsLeaving(false);
    } else {
      router.push("/dm");
    }
  };

  // 방 키 초기화 (전송용 암호화에만 사용)
  useEffect(() => {
    async function initRoomEncryption() {
      try {
        if (myEncryptedRoomKey) {
          const privateKey = await loadPrivateKey(currentUserId);
          if (privateKey) {
            try {
              const decryptedRoomKey = await decryptRoomKey(privateKey, myEncryptedRoomKey);
              setRoomKey(decryptedRoomKey);
              setEncryptionReady(true);
              return;
            } catch {
              const rotated = await rotateThreadRoomKey(threadId);
              if ("myEncryptedRoomKey" in rotated && rotated.myEncryptedRoomKey) {
                const recoveredRoomKey = await decryptRoomKey(privateKey, rotated.myEncryptedRoomKey);
                setRoomKey(recoveredRoomKey);
                setEncryptionReady(true);
                return;
              }
            }
          }
        }

        if (roomKeyBase64) {
          const cryptoKey = await importRoomKey(roomKeyBase64);
          setRoomKey(cryptoKey);
        }
        setEncryptionReady(true);
      } catch {
        setEncryptionReady(true);
      }
    }

    void initRoomEncryption();
  }, [myEncryptedRoomKey, roomKeyBase64, currentUserId, threadId]);

  // 실시간 메시지 구독 (Supabase Realtime)
  useEffect(() => {
    if (!ENABLE_DM_REALTIME) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    
    // 이미지 경로를 public URL로 변환하는 헬퍼
    const toPublicUrl = (imagePath: string | null): string | null => {
      if (!imagePath) return null;
      if (imagePath.startsWith("http")) return imagePath;
      // dm-attachments 버킷의 public URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from("dm-attachments")
        .getPublicUrl(imagePath);
      return publicUrl;
    };
    
    const handleNewMessage = (payload: { new: Record<string, unknown> }) => {
      const newRow = payload.new as {
        id: string;
        sender_id: string;
        thread_id: string;
        encrypted_content: string | null;
        iv: string | null;
        is_encrypted: boolean | null;
        image_url: string | null;
        created_at: string;
      };
      
      // 내가 보낸 메시지는 optimistic update로 이미 추가됨 -> 무시
      if (newRow.sender_id === currentUserId) {
        return;
      }
      
      // 이미 있는 메시지인지 확인 (중복 방지)
      setMessages((prev) => {
        if (prev.some((m) => m.id === newRow.id)) {
          return prev;
        }
        
        // 암호화되지 않은 메시지거나 roomKey가 없으면 바로 추가
        let content = newRow.encrypted_content ?? "";
        
        // 암호화된 메시지인 경우 비동기로 복호화 후 업데이트
        if (newRow.is_encrypted && newRow.encrypted_content && newRow.iv && roomKey) {
          // 일단 placeholder로 추가하고 나중에 복호화된 내용으로 업데이트
          void decryptWithRoomKeyClient(roomKey, newRow.encrypted_content, newRow.iv)
            .then((decrypted) => {
              setMessages((current) =>
                current.map((m) =>
                  m.id === newRow.id ? { ...m, content: decrypted, decrypted_checked: true } : m
                )
              );
            })
            .catch(() => {
              setMessages((current) =>
                current.map((m) =>
                  m.id === newRow.id ? { ...m, content: "복호화 실패", decrypt_failed: true, decrypted_checked: true } : m
                )
              );
            });
          content = "복호화 중...";
        } else if (newRow.is_encrypted) {
          content = "암호화된 메시지";
        }

        const needsDecrypt = Boolean(newRow.is_encrypted && newRow.encrypted_content && newRow.iv && roomKey);
        
        return [...prev, {
          id: newRow.id,
          sender_id: newRow.sender_id,
          content,
          created_at: newRow.created_at,
          is_encrypted: newRow.is_encrypted ?? false,
          decrypted_checked: !needsDecrypt,
          image_url: toPublicUrl(newRow.image_url),  // 경로를 public URL로 변환
        }];
      });

      if (!atBottom) {
        setHasNewIncoming(true);
      }
    };

    const channel = supabase
      .channel(`dm-thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        handleNewMessage
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, roomKey, currentUserId, atBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (atBottom) {
      scrollToBottom("auto");
    }
  }, [messages, atBottom, scrollToBottom]);

  useEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setShowMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMenu]);

  useEffect(() => {
    if (!roomKey) return;

    const targets = messages.filter(
      (message) =>
        message.is_encrypted &&
        message.encrypted_content &&
        message.iv &&
        !message.decrypted_checked
    );

    if (targets.length === 0) return;

    // 대화가 길어질 때 한 번에 전체 복호화를 수행하면 탭이 멈출 수 있어 배치 처리한다.
    const BATCH_SIZE = 30;
    const batch = targets.slice(0, BATCH_SIZE);
    let canceled = false;

    void (async () => {
      const resolved: Array<{ id: string; content: string; decrypt_failed: boolean }> = [];

      for (const message of batch) {
        if (canceled) return;
        try {
          const content = await decryptWithRoomKeyClient(roomKey, message.encrypted_content!, message.iv!);
          resolved.push({ id: message.id, content, decrypt_failed: false });
        } catch {
          resolved.push({ id: message.id, content: "복호화 실패", decrypt_failed: true });
        }
      }

      if (canceled) return;
      setMessages((prev) =>
        prev.map((message) => {
          const found = resolved.find((item) => item.id === message.id);
          return found
            ? {
                ...message,
                content: found.content,
                decrypt_failed: found.decrypt_failed,
                decrypted_checked: true,
              }
            : message;
        })
      );
    })();

    return () => {
      canceled = true;
    };
  }, [roomKey, messages]);

  useEffect(() => {
    const sharedIds = Array.from(
      new Set(
        messages
          .map((message) => (message.content ? parseSharedItemMessage(message.content) : null))
          .filter((shared): shared is NonNullable<ReturnType<typeof parseSharedItemMessage>> => Boolean(shared?.itemId))
          .map((shared) => shared.itemId)
      )
    );

    const missingIds = sharedIds.filter((id) => !sharedItemPreviews[id]);
    if (missingIds.length === 0) return;

    let canceled = false;

    void Promise.all(
      missingIds.map(async (id) => {
        const response = await fetch(`/api/items/${id}/preview`, { cache: "no-store" });
        if (!response.ok) return null;
        const data = (await response.json()) as SharedItemPreview;
        return data;
      })
    ).then((results) => {
      if (canceled) return;
      const nextEntries = results.filter((item): item is SharedItemPreview => Boolean(item));
      if (nextEntries.length === 0) return;
      setSharedItemPreviews((prev) => {
        const next = { ...prev };
        nextEntries.forEach((item) => {
          next[item.id] = item;
        });
        return next;
      });
    });

    return () => {
      canceled = true;
    };
  }, [messages, sharedItemPreviews]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("JPEG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // 이미지 선택 취소
  const handleCancelImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessageInternal = async (contentParam: string, imageParam: File | null) => {
    const content = contentParam.trim();
    if (!content && !imageParam) {
      setSendError("메시지를 입력해주세요");
      return;
    }
    if (isSending) {
      setSendError("이전 메시지를 전송 중입니다. 잠시 후 다시 시도해주세요");
      return;
    }
    if (!canSend) {
      setSendError("상대방이 DM 요청을 수락해야 메시지를 보낼 수 있습니다");
      return;
    }
    if (uploadingImage) {
      setSendError("이미지 업로드가 끝난 뒤 다시 시도해주세요");
      return;
    }

    setSendError(null);

    let imagePath: string | undefined;
    let imageUrl: string | undefined;
    if (imageParam) {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", imageParam);

      let uploadResult: Awaited<ReturnType<typeof uploadDMImage>>;
      try {
        uploadResult = await withTimeout(
          uploadDMImage(threadId, formData),
          12000,
          "이미지 업로드 시간이 초과되었습니다. 다시 시도해주세요"
        );
      } finally {
        setUploadingImage(false);
      }

      if (uploadResult.error) {
        setSendError(uploadResult.error);
        return;
      }
      imagePath = uploadResult.imagePath;
      imageUrl = uploadResult.imageUrl;
      handleCancelImage();
    }

    setRetryPayload(null);

    setIsSending(true);
    let forceUnlocked = false;
    const failSafeTimer = window.setTimeout(() => {
      forceUnlocked = true;
      setRetryPayload({ content, image: imageParam });
      setSendError("전송 응답이 지연되어 취소되었습니다. 다시 시도해주세요");
      setIsSending(false);
    }, 15000);

    try {
      let encryptedData = undefined;

      if (roomKey && content) {
        const encrypted = await withTimeout(
          encryptWithRoomKey(roomKey, content),
          8000,
          "메시지 암호화 시간이 초과되었습니다. 다시 시도해주세요"
        );
        encryptedData = {
          encryptedContent: encrypted.encryptedContent,
          encryptedKey: "",
          iv: encrypted.iv,
        };
      }

      const result = await withTimeout(
        sendMessage(threadId, content || "", encryptedData, imagePath),
        12000,
        "메시지 전송 시간이 초과되었습니다. 다시 시도해주세요"
      ) as Awaited<ReturnType<typeof sendMessage>>;

      if ("error" in result && result.error) {
        setRetryPayload({ content, image: imageParam });
        setSendError(result.error);
      } else if ("message" in result && result.message) {
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.style.height = "48px";
        }
        setRetryPayload(null);
        setMessages((prev) =>
          [
            ...prev,
            {
              ...result.message!,
              content: content || "",
              image_url: imageUrl ?? result.message!.image_url,
            },
          ]
        );
        scrollToBottom();
      }
    } catch (error) {
      setRetryPayload({ content, image: imageParam });
      if (error instanceof Error && error.message) {
        setSendError(error.message);
      } else {
        setSendError("메시지 전송 실패");
      }
    } finally {
      clearTimeout(failSafeTimer);
      if (!forceUnlocked) {
        setIsSending(false);
      }
    }
  };

  const handleSend = async () => {
    const currentDraft = inputRef.current?.value ?? "";
    await sendMessageInternal(currentDraft, selectedImage);
  };

  const handleRetrySend = async () => {
    if (!retryPayload) return;
    await sendMessageInternal(retryPayload.content, retryPayload.image);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleComposerChange = () => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    const nextHeight = Math.min(inputRef.current.scrollHeight, 144);
    inputRef.current.style.height = `${Math.max(nextHeight, 48)}px`;
  };

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(nearBottom);
    if (nearBottom) {
      setHasNewIncoming(false);
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

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        const isOwn = message.sender_id === currentUserId;
        const isEncrypted = message.is_encrypted;
        const sharedItem = message.content ? parseSharedItemMessage(message.content) : null;
        const sharedPreview = sharedItem?.itemId ? sharedItemPreviews[sharedItem.itemId] : null;

        return (
          <div
            key={message.id}
            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                isOwn
                  ? "bg-neutral-900 text-white dark:bg-neutral-900 dark:text-white"
                  : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
              }`}
            >
              {message.image_url && (
                <img
                  src={message.image_url}
                  alt="첨부 이미지"
                  loading="lazy"
                  decoding="async"
                  className="mb-2 max-w-full rounded-lg"
                  style={{ maxHeight: "200px" }}
                />
              )}
              {sharedItem ? (
                <Link
                  href={sharedItem.path || sharedItem.url}
                  className={`mb-1 block rounded-2xl border px-3 py-3 transition-colors ${
                    isOwn
                      ? "border-white/25 bg-white/10 text-white shadow-sm hover:bg-white/15"
                      : "border-neutral-300 bg-white text-slate-900 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${isOwn ? "text-white/70" : "text-neutral-500 dark:text-neutral-400"}`}>
                    Shared Item
                  </p>
                  <div className="mt-2 flex items-center gap-2.5">
                    {sharedPreview?.image_url ? (
                      <img
                        src={sharedPreview.image_url}
                        alt={sharedPreview.title}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className={`flex h-14 w-14 items-center justify-center rounded-lg text-lg ${
                        isOwn ? "bg-white/20" : "bg-black/10 dark:bg-white/15"
                      }`}>
                        📦
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-snug">
                        {sharedPreview?.title ?? sharedItem.title}
                      </p>
                    </div>
                  </div>
                  {(sharedPreview?.brand || sharedPreview?.category) && (
                    <div className="mt-2 flex gap-1.5">
                      {sharedPreview.brand && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOwn ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/15"
                        }`}>
                          {sharedPreview.brand}
                        </span>
                      )}
                      {sharedPreview.category && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOwn ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/15"
                        }`}>
                          {sharedPreview.category}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      isOwn
                        ? "bg-white/90 text-neutral-900"
                        : "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    }`}>
                      아이템 보기
                    </span>
                  </div>
                </Link>
              ) : message.content && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {message.content}
                </p>
              )}
              <p
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                  isOwn
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {isEncrypted && (
                  <Lock className="h-2.5 w-2.5" />
                )}
                {message.is_pending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {formatTime(message.created_at)}
              </p>
            </div>
          </div>
        );
      }),
    [messages, currentUserId, sharedItemPreviews]
  );

  return (
    <PageShell
      title={
        <div className="flex items-center gap-3">
          <Link href={`/u/${otherUser.handle}`}>
            <Avatar
              src={otherUser.avatar_url}
              alt={otherUser.display_name}
              size="sm"
              fallbackInitial={otherUser.display_name.charAt(0).toUpperCase()}
            />
          </Link>
          <div>
            <div className="font-semibold">{otherUser.display_name}</div>
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              @{otherUser.handle}
              {encryptionReady && roomKey && <Lock aria-label="E2E 암호화 활성화" className="h-3 w-3 text-green-600" />}
            </div>
          </div>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/dm"
            className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            목록
          </Link>
          
          {/* 메뉴 드롭다운 */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleLeave();
                  }}
                  disabled={isLeaving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  {isLeaving ? "나가는 중..." : "대화 나가기"}
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Messages */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden dark:border-neutral-800 dark:bg-black"
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              대화를 시작하세요
            </div>
          ) : (
            <>
              {renderedMessages}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {hasNewIncoming && (
          <div className="-mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                scrollToBottom();
                setHasNewIncoming(false);
              }}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              새 메시지 보기
            </button>
          </div>
        )}

        {/* 이미지 미리보기 */}
        {imagePreview && (
          <div className="relative inline-block">
            <img 
              src={imagePreview} 
              alt="선택된 이미지" 
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleCancelImage}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          {/* 이미지 업로드 버튼 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !canSend || uploadingImage}
            className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-3 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </button>
          
          <textarea
            ref={inputRef}
            onChange={handleComposerChange}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            disabled={isSending || !canSend || uploadingImage}
            rows={1}
            className="max-h-36 min-h-[48px] flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !canSend || uploadingImage}
            className="flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        {!canSend && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            상대방이 DM 요청을 수락하면 메시지를 보낼 수 있습니다.
          </p>
        )}
        {sendError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span>{sendError}</span>
            {retryPayload && (
              <button
                type="button"
                onClick={() => void handleRetrySend()}
                className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
              >
                재시도
              </button>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
