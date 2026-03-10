"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Send, ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { sendMessage } from "@/app/actions/dm";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
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
}

export function DMThreadClient({
  threadId,
  otherUser,
  initialMessages,
  currentUserId,
}: DMThreadClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || isPending) return;

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    startTransition(async () => {
      const result = await sendMessage(threadId, content);
      if (result.error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
        alert(result.error);
      } else if (result.message) {
        // Replace temp message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? result.message! : m))
        );
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
          <Link href={`/u/${otherUser.handle}`} className="relative h-8 w-8 shrink-0">
            {otherUser.avatar_url ? (
              <Image
                src={otherUser.avatar_url}
                alt={otherUser.display_name}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {otherUser.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <div className="font-semibold">{otherUser.display_name}</div>
            <div className="text-xs text-neutral-500">@{otherUser.handle}</div>
          </div>
        </div>
      }
      actions={
        <Link
          href="/dm"
          className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          목록
        </Link>
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
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {message.content}
                      </p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          isOwn
                            ? "text-neutral-400 dark:text-neutral-500"
                            : "text-neutral-500 dark:text-neutral-400"
                        }`}
                      >
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

        {/* Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            disabled={isPending}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!newMessage.trim() || isPending}
            className="flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </PageShell>
  );
}
