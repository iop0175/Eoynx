"use client";

import * as React from "react";
import { useState } from "react";
import { X, Link2, MessageCircle, Loader2, Search, Check } from "lucide-react";
import { Avatar } from "@/components/ui/optimized-image";
import { getFollowingList } from "@/app/actions/profile";
import { getOrCreateThread, getThreadDetails, sendMessage } from "@/app/actions/dm";
import { decryptRoomKey, encryptWithRoomKey, loadPrivateKey } from "@/lib/crypto";

type ShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  itemImageUrl?: string | null;
};

type User = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

function extractRedirectUrlFromError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const digest = "digest" in error ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest !== "string") return null;
  if (!digest.startsWith("NEXT_REDIRECT")) return null;

  const parts = digest.split(";");
  if (parts.length < 4) return null;

  const redirectUrl = parts[2];
  return redirectUrl || null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function ShareModal({ isOpen, onClose, itemId, itemTitle, itemImageUrl }: ShareModalProps) {
  const [mode, setMode] = useState<"options" | "dm">("options");
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/i/${itemId}` 
    : `/i/${itemId}`;

  // Load following list when DM mode is selected
  const handleDMMode = async () => {
    setMode("dm");
    setLoading(true);
    try {
      const result = await getFollowingList();
      if (result.following) {
        setFollowingList(result.following);
      }
    } catch (error) {
      const redirectUrl = extractRedirectUrlFromError(error);
      console.error("Failed to load following list:", error);
      if (redirectUrl) {
        alert(`인증 또는 동의가 필요합니다: ${redirectUrl}`);
      } else {
        alert("팔로잉 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      alert("URL: " + shareUrl);
    }
  };

  // Toggle user selection
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Send DM to selected users
  const handleSendDM = async () => {
    if (selectedUsers.length === 0) return;

    setSending(true);
    try {
      const message = `피드를 공유했습니다\n${itemTitle}\n${shareUrl}`;

      let successCount = 0;
      const failures: string[] = [];

      for (const userId of selectedUsers) {
        try {
          const threadResult = await withTimeout(
            getOrCreateThread(userId),
            10000,
            "DM 스레드 생성 시간이 초과되었습니다"
          );
          if (threadResult.error || !threadResult.threadId) {
            failures.push(threadResult.error ?? "DM 스레드를 생성하지 못했습니다");
            continue;
          }

          const detailResult = await withTimeout(
            getThreadDetails(threadResult.threadId),
            10000,
            "DM 스레드 정보 조회 시간이 초과되었습니다"
          );
          if ("error" in detailResult && detailResult.error) {
            failures.push(detailResult.error);
            continue;
          }

          if (!detailResult.myEncryptedRoomKey || !detailResult.currentUserId) {
            failures.push("암호화 키가 준비되지 않았습니다. 잠시 후 다시 시도해주세요");
            continue;
          }

          const privateKey = await withTimeout(
            loadPrivateKey(detailResult.currentUserId),
            8000,
            "암호화 키 로딩 시간이 초과되었습니다"
          );
          if (!privateKey) {
            failures.push("암호화 키를 불러올 수 없습니다. 다시 로그인 후 시도해주세요");
            continue;
          }

          const roomKey = await withTimeout(
            decryptRoomKey(privateKey, detailResult.myEncryptedRoomKey),
            8000,
            "암호화 키 복호화 시간이 초과되었습니다"
          );
          const encrypted = await withTimeout(
            encryptWithRoomKey(roomKey, message),
            8000,
            "메시지 암호화 시간이 초과되었습니다"
          );

          const sendResult = await withTimeout(
            sendMessage(threadResult.threadId, message, {
              encryptedContent: encrypted.encryptedContent,
              encryptedKey: "",
              iv: encrypted.iv,
            }),
            12000,
            "DM 전송 시간이 초과되었습니다"
          );

          if (sendResult.error) {
            failures.push(sendResult.error);
            continue;
          }

          successCount += 1;
        } catch (error) {
          const redirectUrl = extractRedirectUrlFromError(error);
          if (redirectUrl) {
            failures.push(`인증 또는 동의가 필요합니다: ${redirectUrl}`);
            continue;
          }
          failures.push(error instanceof Error ? error.message : "전송 중 오류가 발생했습니다");
        }
      }

      if (successCount === 0) {
        throw new Error(failures[0] ?? "전송 중 오류가 발생했습니다");
      }

      if (failures.length > 0) {
        alert(`${successCount}명에게 전송되었습니다. 일부 실패: ${failures[0]}`);
      } else {
        alert(`${successCount}명에게 DM으로 공유했습니다`);
      }

      onClose();
    } catch (error) {
      const redirectUrl = extractRedirectUrlFromError(error);
      console.error("Failed to send DM:", error);
      const message = redirectUrl
        ? `인증 또는 동의가 필요합니다: ${redirectUrl}`
        : error instanceof Error
          ? error.message
          : "전송 중 오류가 발생했습니다";
      alert(message);
    } finally {
      setSending(false);
    }
  };

  // Filter users by search query
  const filteredUsers = followingList.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.handle.toLowerCase().includes(query) ||
      (user.display_name?.toLowerCase().includes(query) ?? false)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-sm mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-semibold">
            {mode === "options" ? "공유하기" : "DM으로 공유"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {mode === "options" ? (
          <div className="p-4 space-y-3">
            {/* Item preview */}
            {itemImageUrl && (
              <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <img 
                  src={itemImageUrl} 
                  alt={itemTitle}
                  className="h-12 w-12 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{itemTitle}</p>
                  <p className="text-xs text-neutral-500 truncate">{shareUrl}</p>
                </div>
              </div>
            )}

            {/* Share options */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">링크 복사</p>
                <p className="text-xs text-neutral-500">URL을 클립보드에 복사</p>
              </div>
              {copied && (
                <span className="text-xs text-green-600 font-medium">복사됨!</span>
              )}
            </button>

            <button
              onClick={handleDMMode}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">DM으로 공유</p>
                <p className="text-xs text-neutral-500">팔로잉 중인 사용자에게 전송</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
            {/* Search input */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="사용자 검색..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-sm text-neutral-500">
                  {followingList.length === 0 
                    ? "팔로잉 중인 사용자가 없습니다" 
                    : "검색 결과가 없습니다"}
                </div>
              ) : (
                filteredUsers.map(user => {
                  const isSelected = selectedUsers.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        isSelected 
                          ? "bg-blue-50 dark:bg-blue-900/20" 
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <Avatar 
                        src={user.avatar_url} 
                        alt={user.display_name ?? user.handle}
                        size="sm"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.display_name ?? user.handle}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">@{user.handle}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected 
                          ? "bg-blue-600 border-blue-600" 
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Send button */}
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={mode === "dm" ? handleSendDM : handleDMMode}
                disabled={mode === "dm" && (selectedUsers.length === 0 || sending)}
                className="w-full py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    전송 중...
                  </>
                ) : (
                  <>
                    전송 ({selectedUsers.length}명)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
