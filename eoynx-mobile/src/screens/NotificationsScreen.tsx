import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useI18n } from "../i18n";
import { decryptWithRoomKey, importRoomKey } from "../lib/dmCrypto";
import { supabase } from "../lib/supabase";
import type { FeedStackParamList } from "../navigation/types";
import { webUi } from "../theme/webUi";
import type { Item } from "../types/item";

type Props = NativeStackScreenProps<FeedStackParamList, "NotificationsHome">;

type NotificationRow = {
  id: string;
  type: "follow" | "like" | "comment" | "dm" | "dm_request";
  actor_id: string | null;
  item_id: string | null;
  thread_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
};

type Actor = { id: string; handle: string; display_name: string | null };
type ItemInfo = { id: string; title: string };
type ThreadInfo = { id: string; room_key: string | null };
type DmMessageRow = {
  thread_id: string;
  sender_id: string;
  encrypted_content: string | null;
  is_encrypted: boolean | null;
  iv: string | null;
  image_url: string | null;
  created_at: string;
};

type EnrichedNotification = NotificationRow & {
  actor?: Actor | null;
  item?: ItemInfo | null;
  dmCount?: number;
  groupedIds?: string[];
};

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  brand: string | null;
  category: string | null;
  visibility: "public" | "unlisted" | "private";
  owner_id: string;
  created_at: string | null;
  profiles: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

export function NotificationsScreen({ navigation }: Props) {
  const { language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,actor_id,item_id,thread_id,preview,read_at,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    setLoading(false);

    if (error) {
      Alert.alert("Load Error", error.message);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    const actorIds = Array.from(new Set(rows.map((n) => n.actor_id).filter(Boolean))) as string[];
    const itemIds = Array.from(new Set(rows.map((n) => n.item_id).filter(Boolean))) as string[];

    const dmThreadIds = Array.from(
      new Set(rows.filter((n) => n.type === "dm" && n.thread_id).map((n) => n.thread_id as string))
    );

    const [actorsRes, itemsRes, threadsRes, dmMessagesRes] = await Promise.all([
      actorIds.length > 0
        ? supabase.from("profiles").select("id,handle,display_name").in("id", actorIds)
        : Promise.resolve({ data: [] as Actor[], error: null }),
      itemIds.length > 0
        ? supabase.from("items").select("id,title").in("id", itemIds)
        : Promise.resolve({ data: [] as ItemInfo[], error: null }),
      dmThreadIds.length > 0
        ? supabase.from("dm_threads").select("id,room_key").in("id", dmThreadIds)
        : Promise.resolve({ data: [] as ThreadInfo[], error: null }),
      dmThreadIds.length > 0
        ? supabase
            .from("dm_messages")
            .select("thread_id,sender_id,encrypted_content,is_encrypted,iv,image_url,created_at")
            .in("thread_id", dmThreadIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as DmMessageRow[], error: null }),
    ]);

    if (actorsRes.error || itemsRes.error || threadsRes.error || dmMessagesRes.error) {
      Alert.alert(
        "Load Error",
        actorsRes.error?.message ??
          itemsRes.error?.message ??
          threadsRes.error?.message ??
          dmMessagesRes.error?.message ??
          "Unknown error"
      );
      return;
    }

    const actorMap = new Map((actorsRes.data ?? []).map((a) => [a.id, a]));
    const itemMap = new Map((itemsRes.data ?? []).map((i) => [i.id, i]));
    const threadRoomKeyMap = new Map((threadsRes.data ?? []).map((t) => [t.id, t.room_key]));

    const latestAnyByThread = new Map<string, DmMessageRow>();
    const latestFromOtherByThread = new Map<string, DmMessageRow>();
    for (const row of (dmMessagesRes.data ?? []) as DmMessageRow[]) {
      if (!latestAnyByThread.has(row.thread_id)) {
        latestAnyByThread.set(row.thread_id, row);
      }
      if (row.sender_id !== uid && !latestFromOtherByThread.has(row.thread_id)) {
        latestFromOtherByThread.set(row.thread_id, row);
      }
    }

    const dmPreviewByThread = new Map<string, string>();
    for (const threadId of dmThreadIds) {
      const picked = latestFromOtherByThread.get(threadId) ?? latestAnyByThread.get(threadId);
      if (!picked) continue;

      if (picked.image_url && !picked.encrypted_content) {
        dmPreviewByThread.set(threadId, language === "ko" ? "사진" : "Photo");
        continue;
      }

      let previewText: string | null = null;
      if (picked.is_encrypted && picked.encrypted_content && picked.iv) {
        const roomKey = threadRoomKeyMap.get(threadId) ?? null;
        if (roomKey) {
          const imported = await importRoomKey(roomKey);
          if (imported) {
            previewText = await decryptWithRoomKey(imported, picked.encrypted_content, picked.iv);
          }
        }
      } else if (picked.encrypted_content) {
        previewText = picked.encrypted_content;
      }

      if (!previewText || !previewText.trim()) {
        previewText = picked.image_url ? (language === "ko" ? "사진" : "Photo") : language === "ko" ? "메시지" : "Message";
      }
      dmPreviewByThread.set(threadId, previewText);
    }

    const enriched = rows.map((row) => ({
      ...row,
      actor: row.actor_id ? actorMap.get(row.actor_id) ?? null : null,
      item: row.item_id ? itemMap.get(row.item_id) ?? null : null,
      preview:
        row.type === "dm" && row.thread_id ? dmPreviewByThread.get(row.thread_id) ?? row.preview : row.preview,
      dmCount: 1,
      groupedIds: [row.id],
    }));

    // Group DM notifications by sender so one sender appears once with +n.
    const grouped: EnrichedNotification[] = [];
    const dmByActor = new Map<string, EnrichedNotification>();

    for (const row of enriched) {
      if (row.type !== "dm") {
        grouped.push(row);
        continue;
      }

      const key = row.actor_id ?? `thread:${row.thread_id ?? row.id}`;
      const existing = dmByActor.get(key);
      if (!existing) {
        dmByActor.set(key, row);
        continue;
      }

      existing.dmCount = (existing.dmCount ?? 1) + 1;
      existing.groupedIds = [...(existing.groupedIds ?? [existing.id]), row.id];
      if (new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
        existing.created_at = row.created_at;
        existing.preview = row.preview;
        existing.thread_id = row.thread_id ?? existing.thread_id;
      }
      if (!row.read_at) {
        existing.read_at = null;
      }
    }

    grouped.push(...dmByActor.values());
    grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(grouped);
  }, [language]);

  useEffect(() => {
    void loadNotifications();
    const unsubscribe = navigation.addListener("focus", () => {
      void loadNotifications();
    });
    return unsubscribe;
  }, [loadNotifications, navigation]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markRead = async (id: string, ids?: string[]): Promise<boolean> => {
    if (!userId) return false;
    const targetIds = ids && ids.length > 0 ? ids : [id];
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", targetIds)
      .eq("user_id", userId);
    if (error) {
      Alert.alert("Update Error", error.message);
      return false;
    }
    setNotifications((prev) =>
      prev.map((n) =>
        targetIds.includes(n.id) || (n.groupedIds ?? []).some((gid) => targetIds.includes(gid))
          ? { ...n, read_at: now }
          : n
      )
    );
    return true;
  };

  const markAllRead = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      Alert.alert("Update Error", error.message);
      return;
    }
    await loadNotifications();
  };

  const clearAll = async () => {
    if (!userId) return;
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
    if (error) {
      Alert.alert("Delete Error", error.message);
      return;
    }
    setNotifications([]);
  };

  const deleteNotification = async (id: string, ids?: string[]) => {
    if (!userId) return;
    const targetIds = ids && ids.length > 0 ? ids : [id];
    const { error } = await supabase.from("notifications").delete().in("id", targetIds).eq("user_id", userId);
    if (error) {
      Alert.alert("Delete Error", error.message);
      return;
    }
    setNotifications((prev) =>
      prev.filter((n) => {
        if (targetIds.includes(n.id)) return false;
        const groupedIds = n.groupedIds ?? [];
        if (groupedIds.some((gid) => targetIds.includes(gid))) return false;
        return true;
      })
    );
  };

  const getThreadHandle = async (threadId: string): Promise<string | null> => {
    if (!userId) return null;

    const { data: thread, error: threadError } = await supabase
      .from("dm_threads")
      .select("participant1_id,participant2_id")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError || !thread) return null;

    const otherId = thread.participant1_id === userId ? thread.participant2_id : thread.participant1_id;
    const { data: profile } = await supabase.from("profiles").select("handle").eq("id", otherId).maybeSingle();
    return profile?.handle ?? null;
  };

  const getFeedItem = async (itemId: string): Promise<Item | null> => {
    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at,profiles(handle,display_name,avatar_url)")
      .eq("id", itemId)
      .maybeSingle<ItemRow>();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      image_url: data.image_url,
      image_urls: data.image_urls,
      brand: data.brand,
      category: data.category,
      visibility: data.visibility,
      owner_id: data.owner_id,
      created_at: data.created_at,
      owner: {
        handle: data.profiles?.handle ?? "unknown",
        display_name: data.profiles?.display_name ?? null,
        avatar_url: data.profiles?.avatar_url ?? null,
      },
      like_count: 0,
      comment_count: 0,
      liked: false,
      bookmarked: false,
    };
  };

  const openNotification = async (notification: EnrichedNotification) => {
    const groupedIds = notification.groupedIds ?? [notification.id];
    if (!notification.read_at) {
      await markRead(notification.id, groupedIds);
    }

    if (notification.type === "follow" && notification.actor) {
      navigation.navigate("UserProfile", {
        ownerId: notification.actor.id,
        handle: notification.actor.handle,
      });
      return;
    }

    if ((notification.type === "like" || notification.type === "comment") && notification.item_id) {
      const item = await getFeedItem(notification.item_id);
      if (item) {
        navigation.navigate("FeedItemDetail", { item });
      } else {
        Alert.alert(language === "ko" ? "접근 불가" : "Unavailable", language === "ko" ? "해당 아이템을 찾을 수 없습니다." : "This item is no longer available.");
      }
      return;
    }

    if (notification.type === "dm") {
      if (notification.thread_id) {
        const otherHandle = await getThreadHandle(notification.thread_id);
        if (otherHandle) {
          navigation.navigate("DMThread", { threadId: notification.thread_id, otherHandle });
          return;
        }
      }
      navigation.navigate("DMInbox");
      return;
    }

    if (notification.type === "dm_request") {
      navigation.navigate("DMRequests");
    }
  };

  const formatText = (n: EnrichedNotification) => {
    const actor = n.actor?.display_name ?? n.actor?.handle ?? (language === "ko" ? "누군가" : "Someone");
    const item = n.item?.title ?? (language === "ko" ? "회원님의 아이템" : "your item");
    if (n.type === "follow") return language === "ko" ? `${actor}님이 회원님을 팔로우했습니다` : `${actor} followed you`;
    if (n.type === "like") return language === "ko" ? `${actor}님이 ${item}을(를) 좋아합니다` : `${actor} liked ${item}`;
    if (n.type === "comment") {
      if (n.preview === "comment_like" || n.preview === "liked your comment") {
        return language === "ko" ? `${actor}님이 회원님의 댓글을 좋아합니다` : `${actor} liked your comment`;
      }
      if (n.preview === "reply_like" || n.preview === "liked your reply") {
        return language === "ko" ? `${actor}님이 회원님의 답글을 좋아합니다` : `${actor} liked your reply`;
      }
      return language === "ko" ? `${actor}님이 ${item}에 댓글을 남겼습니다` : `${actor} commented on ${item}`;
    }
    if (n.type === "dm") {
      const extra = Math.max(0, (n.dmCount ?? 1) - 1);
      if (language === "ko") return extra > 0 ? `${actor}님이 DM을 보냈습니다 +${extra}` : `${actor}님이 DM을 보냈습니다`;
      return extra > 0 ? `${actor} sent you a DM +${extra}` : `${actor} sent you a DM`;
    }
    return language === "ko" ? `${actor}님이 DM 요청을 보냈습니다` : `${actor} sent a DM request`;
  };

  const formatTime = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - created) / 60000));
    if (diffMin < 1) return language === "ko" ? "방금" : "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(createdAt).toLocaleDateString();
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).reduce((acc, n) => acc + (n.dmCount ?? 1), 0),
    [notifications]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{language === "ko" ? "알림" : "Notifications"}</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 ? (
            <Pressable onPress={() => void markAllRead()} style={styles.headerButton}>
              <Text style={styles.headerButtonLabel}>{language === "ko" ? "전체 읽음" : "Mark all read"}</Text>
            </Pressable>
          ) : null}
          {notifications.length > 0 ? (
            <Pressable onPress={() => void clearAll()} style={styles.headerButton}>
              <Text style={styles.headerButtonDanger}>{language === "ko" ? "전체 삭제" : "Clear all"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.subtitle}>{language === "ko" ? `읽지 않음 ${unreadCount}` : `${unreadCount} unread`}</Text>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>{language === "ko" ? "아직 알림이 없습니다." : "No notifications yet."}</Text>}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void openNotification(item)}
            style={[styles.card, !item.read_at && styles.unreadCard]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardText}>{formatText(item)}</Text>
              <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
            </View>
            {item.preview &&
            item.preview !== "comment_like" &&
            item.preview !== "reply_like" &&
            item.preview !== "liked your comment" &&
            item.preview !== "liked your reply" ? (
              <Text style={styles.preview}>"{item.preview}"</Text>
            ) : null}
            <View style={styles.actionRow}>
              {!item.read_at ? (
                <Pressable onPress={() => void markRead(item.id, item.groupedIds)}>
                  <Text style={styles.link}>{language === "ko" ? "읽음" : "Read"}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => void deleteNotification(item.id, item.groupedIds)}>
                <Text style={styles.linkDanger}>{language === "ko" ? "삭제" : "Delete"}</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: webUi.layout.pageGap,
    maxWidth: webUi.layout.pageMaxWidth,
    width: "100%",
  },
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", gap: 6 },
  title: { color: webUi.color.text, fontSize: webUi.typography.pageTitle, fontWeight: "700" },
  subtitle: { color: webUi.color.textMuted, fontSize: webUi.typography.pageSubtitle },
  headerButton: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: webUi.layout.controlVerticalPadding - 4,
  },
  headerButtonLabel: { color: webUi.color.textSecondary, fontSize: 12, fontWeight: "600" },
  headerButtonDanger: { color: webUi.color.danger, fontSize: 12, fontWeight: "700" },
  loader: { marginTop: 8 },
  card: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
    padding: 12,
  },
  unreadCard: {
    backgroundColor: webUi.color.noticeBg,
    borderColor: webUi.color.noticeBorder,
  },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" },
  cardText: { color: webUi.color.text, flex: 1, fontSize: 13, fontWeight: "600" },
  timeText: { color: webUi.color.textMuted, fontSize: 11 },
  preview: { color: webUi.color.textMuted, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  link: { color: webUi.color.textSecondary, fontSize: 12, fontWeight: "700" },
  linkDanger: { color: webUi.color.danger, fontSize: 12, fontWeight: "700" },
  empty: { color: webUi.color.textMuted, marginTop: 24, textAlign: "center" },
});
