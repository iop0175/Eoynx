"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Heart, MessageSquare, UserPlus, Check, Trash2, Mail } from "lucide-react";
import { Avatar } from "@/components/ui/optimized-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  type Notification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/app/actions/notifications";

interface NotificationsClientProps {
  initialNotifications: Notification[];
  currentUserId: string;
}

export function NotificationsClient({ initialNotifications, currentUserId }: NotificationsClientProps) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();

  // 실시간 알림 구독 (Supabase Realtime)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          // 새 알림이 오면 페이지 새로고침으로 최신 데이터 가져오기
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  const handleMarkAsRead = async (id: string) => {
    startTransition(async () => {
      const result = await markNotificationAsRead(id);
      if (!result.error) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      }
    });
  };

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      const result = await markAllNotificationsAsRead();
      if (!result.error) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
        );
      }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (!result.error) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    });
  };

  const handleClearAll = async () => {
    if (!confirm(t("clearConfirm"))) return;
    startTransition(async () => {
      const result = await clearAllNotifications();
      if (!result.error) {
        setNotifications([]);
      }
    });
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "follow":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "dm":
      case "dm_request":
        return <Mail className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    const actorName = notification.actor?.display_name ?? notification.actor?.handle ?? t("someone");
    const itemTitle = notification.item?.title ?? t("itemFallback");

    switch (notification.type) {
      case "follow":
        return t("types.follow", { actor: actorName });
      case "like":
        return t("types.like", { actor: actorName, item: itemTitle });
      case "comment":
        if (notification.preview === "comment_like" || notification.preview === "liked your comment") {
          return locale === "ko" ? `${actorName}님이 회원님의 댓글을 좋아합니다` : `${actorName} liked your comment`;
        }
        if (notification.preview === "reply_like" || notification.preview === "liked your reply") {
          return locale === "ko" ? `${actorName}님이 회원님의 답글을 좋아합니다` : `${actorName} liked your reply`;
        }
        return t("types.comment", { actor: actorName, item: itemTitle });
      case "dm":
        return t("types.dm", { actor: actorName });
      case "dm_request":
        return t("types.dmRequest", { actor: actorName });
      default:
        return t("newNotification");
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case "follow":
        return notification.actor ? `/u/${notification.actor.handle}` : null;
      case "like":
      case "comment":
        return notification.item ? `/i/${notification.item.id}` : null;
      case "dm":
        return notification.thread_id ? `/dm/${notification.thread_id}` : "/dm";
      case "dm_request":
        return "/dm/requests";
      default:
        return null;
    }
  };

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

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="mb-4 h-12 w-12 text-neutral-300 dark:text-neutral-700" />
        <p className="text-sm text-neutral-500">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      {(unreadCount > 0 || notifications.length > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {unreadCount > 0 ? t("unreadCount", { count: unreadCount }) : t("allRead")}
          </p>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white"
              >
                <Check className="h-3.5 w-3.5" />
                {t("markAllRead")}
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-neutral-600 hover:text-red-600 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("clearAll")}
              </button>
            </div>
          </div>
      )}

      {/* Notification List */}
      <div className="space-y-2">
        {notifications.map((notification) => {
          const link = getNotificationLink(notification);
          const isUnread = !notification.read_at;

          const content = (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                isUnread
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                  : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:hover:bg-neutral-900"
              }`}
            >
              {/* Actor Avatar */}
              {notification.actor ? (
                <Link
                  href={`/u/${notification.actor.handle}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar
                    src={notification.actor.avatar_url}
                    alt={notification.actor.display_name ?? notification.actor.handle}
                    size="md"
                    fallbackInitial={(notification.actor.display_name ?? notification.actor.handle).charAt(0).toUpperCase()}
                  />
                </Link>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  {getNotificationIcon(notification.type)}
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm">
                      {getNotificationText(notification)}
                    </p>
                    {notification.preview &&
                    notification.preview !== "comment_like" &&
                    notification.preview !== "reply_like" &&
                    notification.preview !== "liked your comment" &&
                    notification.preview !== "liked your reply" && (
                      <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                        &quot;{notification.preview}&quot;
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-400">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  {getNotificationIcon(notification.type)}
                </div>
              </div>

              {/* Item Thumbnail */}
              {notification.item?.image_url && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={notification.item.image_url}
                    alt={notification.item.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                {isUnread && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMarkAsRead(notification.id);
                    }}
                    disabled={isPending}
                    className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                    title={t("markRead")}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(notification.id);
                  }}
                  disabled={isPending}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                  title={t("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );

          if (link) {
            return (
              <Link
                key={notification.id}
                href={link}
                className="block"
                onClick={() => {
                  if (isUnread) {
                    handleMarkAsRead(notification.id);
                  }
                }}
              >
                {content}
              </Link>
            );
          }

          return <div key={notification.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
