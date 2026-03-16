import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useI18n } from "../../i18n";
import { supabase } from "../../lib/supabase";
import { decryptWithRoomKey, importRoomKey } from "../../lib/dmCrypto";
import type { FeedStackParamList } from "../../navigation/types";
import { webUi } from "../../theme/webUi";

type Props = NativeStackScreenProps<FeedStackParamList, "DMInbox">;

type ThreadRow = {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_at: string;
  room_key: string | null;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

type LastMessage = {
  thread_id: string;
  encrypted_content: string | null;
  is_encrypted: boolean | null;
  iv: string | null;
  image_url: string | null;
  created_at: string;
};

type InboxThread = {
  id: string;
  otherId: string;
  otherHandle: string;
  otherName: string | null;
  otherAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
};

function getInboxPreview(content: string | null, imageUrl: string | null | undefined, t: (key: any, vars?: Record<string, string | number>) => string) {
  const normalized = (content ?? "").trim();
  const sharedMatch =
    normalized.match(/^피드를 공유했습니다\n(.+)\nhttps?:\/\/[^\s]+\/i\/[a-f0-9-]+$/i) ??
    normalized.match(/^📦\s+(.+)\nhttps?:\/\/[^\s]+\/i\/[a-f0-9-]+$/i);
  if (sharedMatch) return t("dm.feedShared", { title: sharedMatch[1].trim() });
  if (!normalized && imageUrl) return t("dm.photo");
  return normalized || t("dm.noMessages");
}

export function DMInboxScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadInbox();
  }, []);

  const loadInbox = async () => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert(t("alert.authError"), authError?.message ?? t("common.unknownError"));
      return;
    }
    const userId = authData.user.id;
    setUserId(userId);

    const { data: rawThreads, error: threadError } = await supabase
      .from("dm_threads")
      .select("id,participant1_id,participant2_id,last_message_at,room_key")
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (threadError) {
      setLoading(false);
      Alert.alert(t("alert.loadError"), threadError.message);
      return;
    }

    const threadRows = (rawThreads ?? []) as ThreadRow[];
    if (threadRows.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const threadIds = threadRows.map((t) => t.id);
    const otherIds = threadRows.map((t) => (t.participant1_id === userId ? t.participant2_id : t.participant1_id));

    const [profilesRes, lastMsgRes, unreadRes] = await Promise.all([
      supabase.from("profiles").select("id,handle,display_name,avatar_url").in("id", otherIds),
      supabase
        .from("dm_messages")
        .select("thread_id,encrypted_content,is_encrypted,iv,image_url,created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("dm_messages")
        .select("thread_id")
        .in("thread_id", threadIds)
        .neq("sender_id", userId)
        .is("read_at", null),
    ]);

    setLoading(false);

    if (profilesRes.error || lastMsgRes.error || unreadRes.error) {
      Alert.alert(t("alert.loadError"), profilesRes.error?.message ?? lastMsgRes.error?.message ?? unreadRes.error?.message ?? t("common.unknownError"));
      return;
    }

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p as ProfileRow]));
    const lastMap = new Map<string, LastMessage>();
    for (const row of (lastMsgRes.data ?? []) as LastMessage[]) {
      if (!lastMap.has(row.thread_id)) {
        lastMap.set(row.thread_id, row);
      }
    }
    const unreadMap = new Map<string, number>();
    for (const row of unreadRes.data ?? []) {
      unreadMap.set(row.thread_id, (unreadMap.get(row.thread_id) ?? 0) + 1);
    }

    const mapped = await Promise.all(
      threadRows.map(async (thread) => {
        const otherId = thread.participant1_id === userId ? thread.participant2_id : thread.participant1_id;
        const profile = profileMap.get(otherId);
        const last = lastMap.get(thread.id);
        let preview: string | null = null;
        if (last) {
          if (last.is_encrypted && last.encrypted_content && last.iv && thread.room_key) {
            const importedRoomKey = await importRoomKey(thread.room_key);
            const decrypted = importedRoomKey
              ? ((await decryptWithRoomKey(importedRoomKey, last.encrypted_content, last.iv)) ?? t("dm.encryptedMessage"))
              : t("dm.encryptedMessage");
            preview = getInboxPreview(decrypted, last.image_url, t);
          } else if (last.is_encrypted) {
            preview = t("dm.encryptedMessage");
          } else {
            preview = getInboxPreview(last.encrypted_content ?? null, last.image_url, t);
          }
        }
        return {
          id: thread.id,
          otherId,
          otherHandle: profile?.handle ?? "unknown",
          otherName: profile?.display_name ?? null,
          otherAvatarUrl: profile?.avatar_url ?? null,
          lastMessage: preview,
          lastMessageAt: thread.last_message_at,
          unreadCount: unreadMap.get(thread.id) ?? 0,
        } as InboxThread;
      })
    );
    setThreads(mapped);
  };

  useEffect(() => {
    if (!userId) return;
    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        void loadInbox();
      }, 150);
    };

    const threadP1Channel = supabase
      .channel(`dm-inbox-threads-p1:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_threads",
          filter: `participant1_id=eq.${userId}`,
        },
        scheduleReload
      )
      .subscribe();

    const threadP2Channel = supabase
      .channel(`dm-inbox-threads-p2:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_threads",
          filter: `participant2_id=eq.${userId}`,
        },
        scheduleReload
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`dm-inbox-messages:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        scheduleReload
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_messages",
        },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(threadP1Channel);
      void supabase.removeChannel(threadP2Channel);
      void supabase.removeChannel(messageChannel);
    };
  }, [userId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("dm.justNow");
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{t("dm.messagesTitle")}</Text>
          <Text style={styles.subtitle}>{t("dm.privateConversations")}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("DMRequests")} style={styles.requestsButton}>
          <Text style={styles.requestsLabel}>{t("dm.requests")}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>{t("dm.noConversations")}</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate("DMThread", {
                threadId: item.id,
                otherHandle: item.otherHandle,
                otherName: item.otherName,
                otherAvatarUrl: item.otherAvatarUrl,
                prefillText: route.params?.shareText,
              })
            }
            style={styles.card}
          >
            <View style={styles.avatarWrap}>
              {item.otherAvatarUrl ? (
                <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarLabel}>{(item.otherName ?? item.otherHandle).slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.contentWrap}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.otherName ?? `@${item.otherHandle}`}
                </Text>
                <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
                {item.unreadCount > 0 ? <Text style={styles.badge}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.preview}>
                {item.lastMessage ?? t("dm.noMessages")}
              </Text>
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
  title: { color: webUi.color.text, fontSize: webUi.typography.pageTitle, fontWeight: "700" },
  subtitle: { color: webUi.color.textMuted, fontSize: webUi.typography.pageSubtitle, marginTop: 2 },
  requestsButton: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  requestsLabel: { color: webUi.color.textSecondary, fontSize: 12, fontWeight: "600" },
  loader: { marginTop: 8 },
  card: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    padding: 14,
  },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    width: 44,
  },
  avatar: { height: "100%", width: "100%" },
  avatarLabel: { color: webUi.color.textSecondary, fontSize: 16, fontWeight: "700" },
  contentWrap: { flex: 1, gap: 4 },
  timeText: { color: webUi.color.textMuted, fontSize: 11, marginLeft: 6 },
  cardTitle: { color: webUi.color.text, flex: 1, fontSize: 14, fontWeight: "700" },
  preview: { color: webUi.color.textMuted, fontSize: 12 },
  empty: { color: webUi.color.textMuted, marginTop: 24, textAlign: "center" },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
  },
  badge: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: 999,
    color: webUi.color.primaryText,
    fontSize: 10,
    fontWeight: "700",
    justifyContent: "center",
    marginLeft: 8,
    minWidth: 18,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
