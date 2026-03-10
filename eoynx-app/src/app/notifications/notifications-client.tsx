"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Heart, MessageSquare, UserPlus, Check, Trash2, Mail } from "lucide-react";
import {
  type Notification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/app/actions/notifications";

interface NotificationsClientProps {
  initialNotifications: Notification[];
}

export function NotificationsClient({ initialNotifications }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();

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
    if (!confirm("모든 알림을 삭제하시겠습니까?")) return;
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
    const actorName = notification.actor?.display_name ?? notification.actor?.handle ?? "누군가";
    const itemTitle = notification.item?.title ?? "아이템";

    switch (notification.type) {
      case "follow":
        return `${actorName}님이 회원님을 팔로우했습니다`;
      case "like":
        return `${actorName}님이 "${itemTitle}"을(를) 좋아합니다`;
      case "comment":
        return `${actorName}님이 "${itemTitle}"에 댓글을 달았습니다`;
      case "dm":
        return `${actorName}님이 메시지를 보냈습니다`;
      case "dm_request":
        return `${actorName}님이 메시지 요청을 보냈습니다`;
      default:
        return "새 알림";
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

    if (minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="mb-4 h-12 w-12 text-neutral-300 dark:text-neutral-700" />
        <p className="text-sm text-neutral-500">알림이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      {(unreadCount > 0 || notifications.length > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {unreadCount > 0 ? `${unreadCount}개의 읽지 않은 알림` : "모든 알림을 읽었습니다"}
          </p>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white"
              >
                <Check className="h-3.5 w-3.5" />
                모두 읽음
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-neutral-600 hover:text-red-600 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              모두 삭제
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
                  className="relative h-10 w-10 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {notification.actor.avatar_url ? (
                    <Image
                      src={notification.actor.avatar_url}
                      alt={notification.actor.display_name ?? notification.actor.handle}
                      fill
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {(notification.actor.display_name ?? notification.actor.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
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
                    {notification.preview && (
                      <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                        "{notification.preview}"
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
                    title="읽음 표시"
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
                  title="삭제"
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
