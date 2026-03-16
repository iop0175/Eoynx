"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare, Bell } from "lucide-react";
import type { DMThread } from "@/app/actions/dm";
import { Avatar } from "@/components/ui/optimized-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DMInboxClientProps = {
  threads: DMThread[];
  requestCount: number;
  currentUserId: string;
};

function getInboxPreview(content: string, imageUrl?: string | null) {
  const normalized = content.trim();

  const sharedMatch =
    normalized.match(/^피드를 공유했습니다\n(.+)\nhttps?:\/\/[^\s]+\/i\/[a-f0-9-]+$/i) ??
    normalized.match(/^📦\s+(.+)\nhttps?:\/\/[^\s]+\/i\/[a-f0-9-]+$/i);

  if (sharedMatch) {
    return `피드 공유 · ${sharedMatch[1].trim()}`;
  }

  if (!normalized && imageUrl) {
    return "사진";
  }

  return normalized || "메시지를 확인해보세요";
}

export function DMInboxClient({ threads, requestCount, currentUserId }: DMInboxClientProps) {
  const router = useRouter();
  const t = useTranslations("dm");
  const locale = useLocale();
  const [threadList, setThreadList] = React.useState<DMThread[]>(threads);
  const [showUnreadOnly, setShowUnreadOnly] = React.useState(false);
  const reloadTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const threadIdsRef = React.useRef<Set<string>>(new Set(threads.map((thread) => thread.id)));

  React.useEffect(() => {
    setThreadList(threads);
    threadIdsRef.current = new Set(threads.map((thread) => thread.id));
  }, [threads]);

  React.useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  // 실시간 구독 (Supabase Realtime) - 스레드 및 메시지 변경 감지
  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    
    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 150);
    };

    // participant1로 참여한 스레드 변경 감지
    const threadP1Channel = supabase
      .channel(`dm-inbox-threads-p1:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_threads",
          filter: `participant1_id=eq.${currentUserId}`,
        },
        scheduleReload
      )
      .subscribe();

    // participant2로 참여한 스레드 변경 감지
    const threadP2Channel = supabase
      .channel(`dm-inbox-threads-p2:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_threads",
          filter: `participant2_id=eq.${currentUserId}`,
        },
        scheduleReload
      )
      .subscribe();

    // 새 메시지 도착 시 목록 갱신
    const messageChannel = supabase
      .channel(`dm-inbox-messages:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        (payload) => {
          const newMessage = payload.new as { thread_id: string; sender_id: string };
          // 내 스레드에 대한 메시지인지 확인
          const isMyThread = threadIdsRef.current.has(newMessage.thread_id);
          if (isMyThread) {
            scheduleReload();
          }
        }
      )
      .subscribe();

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      void supabase.removeChannel(threadP1Channel);
      void supabase.removeChannel(threadP2Channel);
      void supabase.removeChannel(messageChannel);
    };
  }, [currentUserId, router]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("justNow");
    if (minutes < 60) return t("minutesAgo", { count: minutes });
    if (hours < 24) return t("hoursAgo", { count: hours });
    if (days < 7) return t("daysAgo", { count: days });
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  const sortedThreads = React.useMemo(() => {
    const next = [...threadList].sort((a, b) => {
      const aUnread = a.unread_count > 0 ? 1 : 0;
      const bUnread = b.unread_count > 0 ? 1 : 0;
      if (aUnread !== bUnread) {
        return bUnread - aUnread;
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
    if (!showUnreadOnly) {
      return next;
    }
    return next.filter((thread) => thread.unread_count > 0);
  }, [showUnreadOnly, threadList]);

  const unreadThreadCount = React.useMemo(
    () => threadList.filter((thread) => thread.unread_count > 0).length,
    [threadList]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("subtitle")}</p>
        </div>
        <Link
          href="/dm/requests"
          className="relative flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Bell className="h-3.5 w-3.5" />
          {t("requests")}
          {requestCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {requestCount > 9 ? "9+" : requestCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {unreadThreadCount > 0
            ? `읽지 않은 대화 ${unreadThreadCount}개`
            : "모든 대화를 읽었습니다"}
        </p>
        <button
          type="button"
          onClick={() => setShowUnreadOnly((prev) => !prev)}
          className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          {showUnreadOnly ? "전체 보기" : "읽지 않음만"}
        </button>
      </div>

      {/* Threads list */}
      <div className="grid gap-2">
        {sortedThreads.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-950">
            <MessageSquare className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {showUnreadOnly ? "읽지 않은 대화가 없습니다" : t("emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {showUnreadOnly ? "전체 보기로 전환해 모든 대화를 확인하세요" : t("emptyDescription")}
            </p>
          </div>
        ) : (
          sortedThreads.map((thread) => {
            const displayName = thread.other_user.display_name ?? thread.other_user.handle;
            const hasUnread = thread.unread_count > 0;
            const isMine = thread.last_message?.sender_id === currentUserId;

            return (
              <Link
                key={thread.id}
                href={`/dm/${thread.id}`}
                onClick={() =>
                  setThreadList((prev) =>
                    prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t))
                  )
                }
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
                  hasUnread
                    ? "border-neutral-300 bg-neutral-50/70 hover:bg-neutral-100/70 dark:border-neutral-600 dark:bg-neutral-900/80 dark:hover:bg-neutral-900"
                    : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={thread.other_user.avatar_url}
                  alt={displayName}
                  size="lg"
                  fallbackInitial={displayName.charAt(0).toUpperCase()}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${hasUnread ? "text-black dark:text-white" : ""}`}>
                      {displayName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {formatTime(thread.last_message_at)}
                    </span>
                    {hasUnread && (
                      <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-[10px] font-bold text-white dark:bg-white dark:text-black">
                        {thread.unread_count > 9 ? "9+" : thread.unread_count}
                      </span>
                    )}
                  </div>
                  {thread.last_message && (
                    <p className={`mt-0.5 truncate text-sm ${
                      hasUnread 
                        ? "text-neutral-700 dark:text-neutral-300" 
                        : "text-neutral-500 dark:text-neutral-400"
                    }`}>
                      {isMine ? "나: " : ""}
                      {getInboxPreview(thread.last_message.content, thread.last_message.image_url)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
