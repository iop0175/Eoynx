"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, Bell } from "lucide-react";
import type { DMThread } from "@/app/actions/dm";

type DMInboxClientProps = {
  threads: DMThread[];
  requestCount: number;
};

export function DMInboxClient({ threads, requestCount }: DMInboxClientProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분`;
    if (hours < 24) return `${hours}시간`;
    if (days < 7) return `${days}일`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">메시지</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Inbox</p>
        </div>
        <Link
          href="/dm/requests"
          className="relative flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Bell className="h-3.5 w-3.5" />
          요청
          {requestCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {requestCount > 9 ? "9+" : requestCount}
            </span>
          )}
        </Link>
      </div>

      {/* Threads list */}
      <div className="grid gap-2">
        {threads.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-950">
            <MessageSquare className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              아직 메시지가 없습니다
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              프로필에서 Message 버튼을 눌러 대화를 시작하세요
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const displayName = thread.other_user.display_name ?? thread.other_user.handle;

            return (
              <Link
                key={thread.id}
                href={`/dm/${thread.id}`}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
              >
                {/* Avatar */}
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  {thread.other_user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thread.other_user.avatar_url}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-neutral-500">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${thread.unread_count > 0 ? "text-black dark:text-white" : ""}`}>
                      {displayName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {formatTime(thread.last_message_at)}
                    </span>
                    {thread.unread_count > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                        {thread.unread_count > 9 ? "9+" : thread.unread_count}
                      </span>
                    )}
                  </div>
                  {thread.last_message && (
                    <p className={`mt-0.5 truncate text-sm ${
                      thread.unread_count > 0 
                        ? "text-neutral-700 dark:text-neutral-300" 
                        : "text-neutral-500 dark:text-neutral-400"
                    }`}>
                      {thread.last_message.content}
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
