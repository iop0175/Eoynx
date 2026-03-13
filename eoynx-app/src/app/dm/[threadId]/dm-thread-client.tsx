"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, Lock, LogOut, MoreVertical, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/optimized-image";
import { PageShell } from "@/components/page-shell";
import { sendMessage, leaveThread, uploadDMImage } from "@/app/actions/dm";
import {
  encryptWithRoomKey,
  importRoomKey,
} from "@/lib/crypto";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { decryptWithRoomKey as decryptWithRoomKeyClient } from "@/lib/crypto";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // E2E 암호화 필드 (서버에서 복호화 후 전달됨)
  is_encrypted?: boolean;
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
  roomKeyBase64: string | null; // 평문 room key (Base64)
}

export function DMThreadClient({
  threadId,
  otherUser,
  initialMessages,
  currentUserId,
  canSend,
  roomKeyBase64,
}: DMThreadClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      if (!roomKeyBase64) {
        setEncryptionReady(true);
        return;
      }

      try {
        const cryptoKey = await importRoomKey(roomKeyBase64);
        setRoomKey(cryptoKey);
        setEncryptionReady(true);
      } catch (error) {
        console.error("Room key import failed:", error);
        setEncryptionReady(true);
      }
    }

    initRoomEncryption();
  }, [roomKeyBase64]);

  // 실시간 메시지 구독 (Supabase Realtime)
  useEffect(() => {
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
                  m.id === newRow.id ? { ...m, content: decrypted } : m
                )
              );
            })
            .catch(() => {
              setMessages((current) =>
                current.map((m) =>
                  m.id === newRow.id ? { ...m, content: "복호화 실패" } : m
                )
              );
            });
          content = "복호화 중...";
        }
        
        return [...prev, {
          id: newRow.id,
          sender_id: newRow.sender_id,
          content,
          created_at: newRow.created_at,
          is_encrypted: newRow.is_encrypted ?? false,
          image_url: toPublicUrl(newRow.image_url),  // 경로를 public URL로 변환
        }];
      });
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
      .subscribe((status) => {
        console.log(`[DM Realtime] Channel status: ${status}`);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, roomKey, currentUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content && !selectedImage) return;
    if (isPending || !canSend || uploadingImage) return;

    // 이미지 업로드 먼저 처리
    let imagePath: string | undefined;  // DB 저장용 경로
    let imageUrl: string | undefined;   // 클라이언트 표시용 URL
    if (selectedImage) {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", selectedImage);
      
      const uploadResult = await uploadDMImage(threadId, formData);
      console.log("[DM Upload] Result:", uploadResult);
      setUploadingImage(false);
      
      if (uploadResult.error) {
        alert(uploadResult.error);
        return;
      }
      imagePath = uploadResult.imagePath;
      imageUrl = uploadResult.imageUrl;
      console.log("[DM Upload] imagePath:", imagePath, "imageUrl:", imageUrl);
      handleCancelImage();
    }

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: content || "",
      created_at: new Date().toISOString(),
      image_url: imageUrl,  // 표시용 URL 사용
    };
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    startTransition(async () => {
      try {
        let encryptedData = undefined;
        
        // 방 키가 있고 텍스트가 있으면 암호화
        if (roomKey && content) {
          const encrypted = await encryptWithRoomKey(roomKey, content);
          encryptedData = {
            encryptedContent: encrypted.encryptedContent,
            encryptedKey: "", // 방 키 방식에서는 사용 안함
            iv: encrypted.iv,
          };
        }
        
        const result = await sendMessage(threadId, content || "", encryptedData, imagePath);  // 경로 저장
        
        if (result.error) {
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
          alert(result.error);
        } else if (result.message) {
          // Replace temp message with real one, but keep the original imageUrl (signed URL)
          setMessages((prev) =>
            prev.map((m) => (m.id === tempMessage.id 
              ? { ...result.message!, content: content || "", image_url: imageUrl ?? result.message!.image_url } 
              : m))
          );
        }
      } catch (error) {
        console.error("Send failed:", error);
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
        alert("메시지 전송 실패");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
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
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Messages */}
        <div className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              대화를 시작하세요
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isOwn = message.sender_id === currentUserId;
                const isEncrypted = message.is_encrypted;
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black"
                          : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      }`}
                    >
                      {/* 이미지 표시 */}
                      {message.image_url && (
                        <img 
                          src={message.image_url} 
                          alt="첨부 이미지"
                          className="mb-2 max-w-full rounded-lg"
                          style={{ maxHeight: "200px" }}
                        />
                      )}
                      {message.content && (
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
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

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
            disabled={isPending || !canSend || uploadingImage}
            className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-3 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </button>
          
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            disabled={isPending || !canSend || uploadingImage}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={(!newMessage.trim() && !selectedImage) || isPending || !canSend || uploadingImage}
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
      </div>
    </PageShell>
  );
}
