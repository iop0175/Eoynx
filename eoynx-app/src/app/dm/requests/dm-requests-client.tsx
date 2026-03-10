"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { respondToDMRequest, type DMRequest } from "@/app/actions/dm";

interface DMRequestsClientProps {
  initialRequests: DMRequest[];
}

export function DMRequestsClient({ initialRequests }: DMRequestsClientProps) {
  const [requests, setRequests] = useState<DMRequest[]>(initialRequests);
  const [isPending, startTransition] = useTransition();

  const handleRespond = async (requestId: string, accept: boolean) => {
    startTransition(async () => {
      const result = await respondToDMRequest(requestId, accept);
      if (!result.error) {
        setRequests((prev) =>
          prev.filter((r) => r.id !== requestId)
        );
      }
    });
  };

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
    return `${days}일`;
  };

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-black">
        <p className="text-sm text-neutral-500">대기 중인 요청이 없습니다</p>
        <Link
          href="/dm"
          className="mt-4 inline-block text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          ← 받은 메시지함으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black"
        >
          <Link
            href={`/u/${request.from_user.handle}`}
            className="relative h-10 w-10 shrink-0"
          >
            {request.from_user.avatar_url ? (
              <Image
                src={request.from_user.avatar_url}
                alt={request.from_user.display_name ?? request.from_user.handle}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {(request.from_user.display_name ?? request.from_user.handle).charAt(0).toUpperCase()}
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/u/${request.from_user.handle}`}
                className="font-medium hover:underline"
              >
                {request.from_user.display_name ?? request.from_user.handle}
              </Link>
              <span className="text-xs text-neutral-500">
                @{request.from_user.handle}
              </span>
              <span className="text-xs text-neutral-400">
                · {formatTime(request.created_at)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => handleRespond(request.id, true)}
              disabled={isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              title="수락"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleRespond(request.id, false)}
              disabled={isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              title="거절"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
