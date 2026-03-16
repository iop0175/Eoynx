import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportModal, type ReportReason } from "../components/ReportModal";
import { useI18n } from "../i18n";
import { encryptWithRoomKey, generateSimpleRoomKey, importRoomKey } from "../lib/dmCrypto";
import { supabase } from "../lib/supabase";
import type { FeedStackParamList } from "../navigation/types";
import { useThemePreference } from "../theme/ThemeContext";
import { webUi } from "../theme/webUi";
import type { Item } from "../types/item";

type Props = NativeStackScreenProps<FeedStackParamList, "FeedList">;
const PAGE_SIZE = 5;

const CATEGORIES = [
  { id: "all" },
  { id: "luxury" },
  { id: "accessories" },
  { id: "cars" },
  { id: "real-estate" },
];

const LOGO_LIGHT = require("../../assets/logo-mark.png");
const LOGO_DARK = require("../../assets/logo-mark-white.png");

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
  created_at: string;
  profiles: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

type CommentPreviewRow = {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ShareFollower = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FeedCommentRow = {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
};

type FeedCommentView = FeedCommentRow & {
  like_count: number;
  is_liked: boolean;
  user: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type ReportCommentTarget = {
  id: string;
  handle: string;
};

const DELETED_COMMENT_SELF_KO = "삭제된 메시지 입니다";
const DELETED_COMMENT_BY_OWNER_KO = "게시자에 의해 삭제됀 메시지 입니다";
const DELETED_COMMENT_SELF_EN = "Deleted message";
const DELETED_COMMENT_BY_OWNER_EN = "Deleted by post owner";

const isDeletedComment = (content: string) =>
  content === DELETED_COMMENT_SELF_KO ||
  content === DELETED_COMMENT_BY_OWNER_KO ||
  content === DELETED_COMMENT_SELF_EN ||
  content === DELETED_COMMENT_BY_OWNER_EN;

function DmIcon() {
  return (
    <Svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
      <Path
        d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v7.5A2.75 2.75 0 0 1 17.25 17H8.62L5.5 19.5V17H6.75A2.75 2.75 0 0 1 4 14.25v-7.5Z"
        stroke={webUi.color.text}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

function HistoryIcon() {
  return (
    <Svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
      <Path
        d="M12 7v5l3 2"
        stroke={webUi.color.text}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
      <Path
        d="M3.5 12a8.5 8.5 0 1 0 2.49-6.01M3.5 5.5V9h3.5"
        stroke={webUi.color.text}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

function ShareActionIcon() {
  return (
    <Svg fill="none" height={15} viewBox="0 0 24 24" width={15}>
      <Path
        d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5"
        stroke={webUi.color.textSecondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function BookmarkActionIcon({ active }: { active: boolean }) {
  return (
    <Svg fill="none" height={15} viewBox="0 0 24 24" width={15}>
      <Path
        d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z"
        fill={active ? webUi.color.primary : "none"}
        stroke={active ? webUi.color.primary : webUi.color.textSecondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function FeedScreen({ navigation }: Props) {
  const { t } = useI18n();
  const { resolvedTheme } = useThemePreference();
  const getCommentDisplayContent = (content: string) => {
    if (content === DELETED_COMMENT_BY_OWNER_KO || content === DELETED_COMMENT_BY_OWNER_EN) {
      return t("feed.commentDeletedByOwner");
    }
    if (content === DELETED_COMMENT_SELF_KO || content === DELETED_COMMENT_SELF_EN) {
      return t("feed.commentDeletedBySelf");
    }
    return content;
  };
  const [itemsLoading, setItemsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [hasMore, setHasMore] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [reportTargetItem, setReportTargetItem] = useState<Item | null>(null);
  const [reportTargetComment, setReportTargetComment] = useState<ReportCommentTarget | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [cardImageIndexById, setCardImageIndexById] = useState<Record<string, number>>({});
  const [cardImageWidthById, setCardImageWidthById] = useState<Record<string, number>>({});
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<Item | null>(null);
  const [dmShareItem, setDmShareItem] = useState<Item | null>(null);
  const [shareFollowersVisible, setShareFollowersVisible] = useState(false);
  const [shareFollowersLoading, setShareFollowersLoading] = useState(false);
  const [shareFollowers, setShareFollowers] = useState<ShareFollower[]>([]);
  const [shareSendingToId, setShareSendingToId] = useState<string | null>(null);
  const [commentsByItem, setCommentsByItem] = useState<Record<string, FeedCommentView[]>>({});
  const [commentsLoadingByItem, setCommentsLoadingByItem] = useState<Record<string, boolean>>({});
  const [commentDraftByItem, setCommentDraftByItem] = useState<Record<string, string>>({});
  const [replyToCommentByItem, setReplyToCommentByItem] = useState<Record<string, FeedCommentView | null>>({});
  const [commentActionLoadingByItem, setCommentActionLoadingByItem] = useState<Record<string, boolean>>({});
  const [commentLikeLoadingById, setCommentLikeLoadingById] = useState<Record<string, boolean>>({});
  const [editingCommentIdByItem, setEditingCommentIdByItem] = useState<Record<string, string | null>>({});
  const [editingCommentDraftByItem, setEditingCommentDraftByItem] = useState<Record<string, string>>({});
  const [commentMutatingById, setCommentMutatingById] = useState<Record<string, boolean>>({});
  const feedItemIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadItems(selectedCategory, false);
  }, [selectedCategory]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      void loadUnreadNotificationCount();
    });
    return unsubscribe;
  }, [navigation, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`feed-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadNotificationCount(userId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    feedItemIdsRef.current = new Set(items.map((item) => item.id));
  }, [items]);

  useEffect(() => {
    const refreshLikeState = async (itemId: string) => {
      const [countRes, likedRes] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("item_id", itemId),
        userId
          ? supabase.from("likes").select("id").eq("item_id", itemId).eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (countRes.error || likedRes.error) return;

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                like_count: countRes.count ?? entry.like_count,
                liked: userId ? Boolean(likedRes.data) : false,
              }
            : entry
        )
      );
    };

    const channel = supabase
      .channel(`feed-likes:${userId ?? "anon"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
        },
        (payload: any) => {
          const affectedItemId = payload?.new?.item_id ?? payload?.old?.item_id;
          if (!affectedItemId) return;
          if (!feedItemIdsRef.current.has(affectedItemId)) return;
          void refreshLikeState(affectedItemId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadUnreadNotificationCount = async (uidInput?: string | null) => {
    const uid = uidInput ?? userId;
    if (!uid) {
      setNotificationUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("read_at", null);

    if (!error) {
      setNotificationUnreadCount(count ?? 0);
    }
  };

  const loadItems = async (category: string, append: boolean) => {
    if (append) {
      if (itemsLoading || loadingMore || !hasMore) return;
      setLoadingMore(true);
    } else {
      setItemsLoading(true);
      setHasMore(true);
    }
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);
    if (uid) {
      const { data: me } = await supabase.from("profiles").select("handle").eq("id", uid).maybeSingle();
      setUserHandle(me?.handle ?? null);
    } else {
      setUserHandle(null);
    }
    void loadUnreadNotificationCount(uid);
    const offset = append ? items.length : 0;

    let query = supabase
      .from("items")
      .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at,profiles(handle,display_name,avatar_url)")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (category !== "all") {
      query = query.ilike("category", category);
    }

    const { data, error } = await query.returns<ItemRow[]>();
    if (append) {
      setLoadingMore(false);
    } else {
      setItemsLoading(false);
    }

    if (error) {
      Alert.alert(t("alert.loadError"), error.message);
      return;
    }

    const rows = data ?? [];
    const itemIds = rows.map((row) => row.id);

    let likeRows: { item_id: string; user_id: string }[] = [];
    let bookmarkRows: { item_id: string }[] = [];
    let commentRows: { item_id: string }[] = [];
    let commentPreviewRows: CommentPreviewRow[] = [];

    if (itemIds.length > 0) {
      const [likesRes, commentsRes, bookmarksRes, commentPreviewRes] = await Promise.all([
        supabase.from("likes").select("item_id,user_id").in("item_id", itemIds),
        supabase.from("comments").select("item_id").in("item_id", itemIds),
        uid
          ? supabase.from("bookmarks").select("item_id").eq("user_id", uid).in("item_id", itemIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("comments")
          .select("id,item_id,user_id,content,created_at")
          .in("item_id", itemIds)
          .order("created_at", { ascending: false }),
      ]);

      if (likesRes.error || commentsRes.error || bookmarksRes.error || commentPreviewRes.error) {
        Alert.alert(
          t("alert.loadError"),
          likesRes.error?.message ??
            commentsRes.error?.message ??
            bookmarksRes.error?.message ??
            commentPreviewRes.error?.message ??
            t("common.unknownError")
        );
        return;
      }

      likeRows = likesRes.data ?? [];
      commentRows = commentsRes.data ?? [];
      bookmarkRows = bookmarksRes.data ?? [];
      commentPreviewRows = (commentPreviewRes.data ?? []) as CommentPreviewRow[];
    }

    const likeCountByItem = new Map<string, number>();
    const commentCountByItem = new Map<string, number>();
    const likedItemSet = new Set<string>();
    const bookmarkedItemSet = new Set<string>(bookmarkRows.map((b) => b.item_id));
    const commentPreviewByItem = new Map<
      string,
      Array<{
        id: string;
        content: string;
        user_handle: string;
        user_display_name: string | null;
      }>
    >();

    for (const row of likeRows) {
      likeCountByItem.set(row.item_id, (likeCountByItem.get(row.item_id) ?? 0) + 1);
      if (uid && row.user_id === uid) {
        likedItemSet.add(row.item_id);
      }
    }

    for (const row of commentRows) {
      commentCountByItem.set(row.item_id, (commentCountByItem.get(row.item_id) ?? 0) + 1);
    }

    const previewUserIds = Array.from(new Set(commentPreviewRows.map((row) => row.user_id)));
    let previewProfilesMap = new Map<string, { handle: string; display_name: string | null }>();
    if (previewUserIds.length > 0) {
      const { data: previewProfiles, error: previewProfilesError } = await supabase
        .from("profiles")
        .select("id,handle,display_name")
        .in("id", previewUserIds);

      if (previewProfilesError) {
        Alert.alert(t("alert.loadError"), previewProfilesError.message);
        return;
      }

      previewProfilesMap = new Map(
        (previewProfiles ?? []).map((profile) => [
          profile.id,
          { handle: profile.handle, display_name: profile.display_name },
        ])
      );
    }

    for (const row of commentPreviewRows) {
      const profile = previewProfilesMap.get(row.user_id);
      const existing = commentPreviewByItem.get(row.item_id) ?? [];
      if (existing.length >= 2) continue;
      existing.push({
        id: row.id,
        content: row.content,
        user_handle: profile?.handle ?? "unknown",
        user_display_name: profile?.display_name ?? null,
      });
      commentPreviewByItem.set(row.item_id, existing);
    }

    const nextItems = rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        image_url: row.image_url,
        image_urls: row.image_urls,
        brand: row.brand,
        category: row.category,
        visibility: row.visibility,
        owner_id: row.owner_id,
        owner: {
          handle: row.profiles?.handle ?? "unknown",
          display_name: row.profiles?.display_name ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
        },
        created_at: row.created_at,
        liked: likedItemSet.has(row.id),
        bookmarked: bookmarkedItemSet.has(row.id),
        like_count: likeCountByItem.get(row.id) ?? 0,
        comment_count: commentCountByItem.get(row.id) ?? 0,
        comment_preview: commentPreviewByItem.get(row.id) ?? [],
      }));

    setItems((prev) => {
      if (!append) return nextItems;
      const map = new Map(prev.map((item) => [item.id, item]));
      for (const item of nextItems) map.set(item.id, item);
      return Array.from(map.values());
    });
    setHasMore(rows.length === PAGE_SIZE);
  };

  const loadMore = () => {
    if (!hasMore) return;
    void loadItems(selectedCategory, true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems(selectedCategory, false);
    setRefreshing(false);
  };

  const handleLikeToggle = async (itemId: string, liked: boolean) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }

    setActionLoading((prev) => ({ ...prev, [itemId]: true }));
    const { error } = liked
      ? await supabase.from("likes").delete().eq("item_id", itemId).eq("user_id", userId)
      : await supabase.from("likes").upsert({ item_id: itemId, user_id: userId }, { onConflict: "user_id,item_id" });
    setActionLoading((prev) => ({ ...prev, [itemId]: false }));

    if (error) {
      Alert.alert(t("alert.likeError"), error.message);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              liked: !liked,
              like_count: liked
                ? Math.max(0, (item.like_count ?? 0) - 1)
                : (item.like_count ?? 0) + 1,
            }
          : item
      )
    );
  };

  const handleBookmarkToggle = async (itemId: string, bookmarked: boolean) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }

    setActionLoading((prev) => ({ ...prev, [itemId]: true }));
    const { error } = bookmarked
      ? await supabase.from("bookmarks").delete().eq("item_id", itemId).eq("user_id", userId)
      : await supabase
          .from("bookmarks")
          .upsert({ item_id: itemId, user_id: userId }, { onConflict: "user_id,item_id" });
    setActionLoading((prev) => ({ ...prev, [itemId]: false }));

    if (error) {
      Alert.alert(t("alert.bookmarkError"), error.message);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              bookmarked: !bookmarked,
            }
          : item
      )
    );
  };

  const handleUrlShare = async (item: Item) => {
    const shareUrl = `https://eoynx.com/i/${item.id}`;
    const shareText = `${item.title}\n${shareUrl}`;
    try {
      await Share.share({
        message: shareText,
        url: shareUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.unknownError");
      Alert.alert(t("alert.shareError"), message);
    }
  };

  const handleDmShare = (item: Item) => {
    void (async () => {
      let uid = userId;
      if (!uid) {
        const { data: authData } = await supabase.auth.getUser();
        uid = authData.user?.id ?? null;
        if (uid) setUserId(uid);
      }
      if (!uid) {
        Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
        return;
      }

      setShareFollowersLoading(true);
      const { data: followerRows, error: followerError } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("following_id", uid)
        .limit(200);

      if (followerError) {
        setShareFollowersLoading(false);
        Alert.alert(t("alert.shareError"), followerError.message);
        return;
      }

      const followerIds = Array.from(
        new Set((followerRows ?? []).map((row) => row.follower_id).filter((id): id is string => typeof id === "string"))
      );

      if (followerIds.length === 0) {
        setShareFollowersLoading(false);
        Alert.alert(t("alert.noFollowersTitle"), t("alert.noFollowersBody"));
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,handle,display_name,avatar_url")
        .in("id", followerIds);

      setShareFollowersLoading(false);
      if (profilesError) {
        Alert.alert(t("alert.shareError"), profilesError.message);
        return;
      }

      const candidates = ((profiles ?? []) as ShareFollower[])
        .filter((p) => p.id !== uid)
        .sort((a, b) => (a.handle ?? "").localeCompare(b.handle ?? ""));

      if (candidates.length === 0) {
        Alert.alert(t("alert.noFollowersTitle"), t("alert.noFollowersBody"));
        return;
      }

      setDmShareItem(item);
      setShareFollowers(candidates);
      setShareFollowersVisible(true);
    })();
  };

  const shareItemToFollower = async (target: ShareFollower) => {
    if (!dmShareItem) return;
    let uid = userId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData.user?.id ?? null;
      if (uid) setUserId(uid);
    }
    if (!uid) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }

    setShareSendingToId(target.id);
    const [one, two] = uid < target.id ? [uid, target.id] : [target.id, uid];

    const existing = await supabase
      .from("dm_threads")
      .select("id,room_key")
      .eq("participant1_id", one)
      .eq("participant2_id", two)
      .maybeSingle();

    if (existing.error) {
      setShareSendingToId(null);
      Alert.alert(t("alert.shareError"), existing.error.message);
      return;
    }

    let threadId = existing.data?.id ?? null;
    let roomKey = existing.data?.room_key ?? null;

    if (!threadId) {
      const generatedRoomKey = await generateSimpleRoomKey();
      const created = await supabase
        .from("dm_threads")
        .insert({
          participant1_id: one,
          participant2_id: two,
          last_message_at: new Date().toISOString(),
          room_key: generatedRoomKey,
        })
        .select("id,room_key")
        .single();

      if (created.error || !created.data) {
        setShareSendingToId(null);
        Alert.alert(t("alert.shareError"), created.error?.message ?? t("common.unknownError"));
        return;
      }
      threadId = created.data.id;
      roomKey = created.data.room_key ?? generatedRoomKey ?? null;
    }

    const shareUrl = `https://eoynx.com/i/${dmShareItem.id}`;

    // Web 정책과 동일: 상대가 DM 요청 수락 전이면 메시지 전송 차단
    const { data: pendingBetween } = await supabase
      .from("dm_requests")
      .select("id,status")
      .eq("status", "pending")
      .or(`and(from_user_id.eq.${uid},to_user_id.eq.${target.id}),and(from_user_id.eq.${target.id},to_user_id.eq.${uid})`)
      .limit(1)
      .maybeSingle();

    if (pendingBetween?.id) {
      setShareSendingToId(null);
      Alert.alert(t("alert.dmRequestPending"), t("alert.dmRequestPendingBody"));
      return;
    }

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("dm_open")
      .eq("id", target.id)
      .maybeSingle();

    const recipientOpen = recipientProfile?.dm_open ?? true;
    if (!recipientOpen) {
      const { data: requestStatus } = await supabase
        .from("dm_requests")
        .select("id,status")
        .eq("from_user_id", uid)
        .eq("to_user_id", target.id)
        .maybeSingle();

      if (requestStatus?.status !== "accepted") {
        if (requestStatus?.id) {
          await supabase
            .from("dm_requests")
            .update({ status: "pending", thread_id: threadId })
            .eq("id", requestStatus.id);
        } else {
          await supabase
            .from("dm_requests")
            .insert({
              from_user_id: uid,
              to_user_id: target.id,
              thread_id: threadId,
            });
        }

        setShareSendingToId(null);
        Alert.alert(t("alert.dmRequestSent"), t("alert.dmRequestSentBody"));
        return;
      }
    }

    const shareText = `피드를 공유했습니다\n${dmShareItem.title}\n${shareUrl}`;
    let insertPayload:
      | {
          thread_id: string;
          sender_id: string;
          encrypted_content: string;
          iv: string;
          is_encrypted: true;
        }
      | {
          thread_id: string;
          sender_id: string;
          encrypted_content: string;
          is_encrypted: false;
        };

    if (roomKey) {
      const imported = await importRoomKey(roomKey);
      const encrypted = imported ? await encryptWithRoomKey(imported, shareText) : null;
      if (encrypted) {
        insertPayload = {
          thread_id: threadId,
          sender_id: uid,
          encrypted_content: encrypted.encryptedContent,
          iv: encrypted.iv,
          is_encrypted: true,
        };
      } else {
        insertPayload = {
          thread_id: threadId,
          sender_id: uid,
          encrypted_content: shareText,
          is_encrypted: false,
        };
      }
    } else {
      insertPayload = {
        thread_id: threadId,
        sender_id: uid,
        encrypted_content: shareText,
        is_encrypted: false,
      };
    }

    const { error: insertError } = await supabase.from("dm_messages").insert(insertPayload);
    if (insertError) {
      setShareSendingToId(null);
      Alert.alert(t("alert.shareError"), insertError.message);
      return;
    }

    await supabase.from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);

    setShareSendingToId(null);
    setShareFollowersVisible(false);
    setDmShareItem(null);
    navigation.navigate("DMThread", {
      threadId,
      otherHandle: target.handle,
      otherName: target.display_name,
      otherAvatarUrl: target.avatar_url,
    });
  };

  const submitItemReport = async (
    item: Item,
    reason: ReportReason,
    description: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) {
      return { ok: false, error: t("alert.pleaseSignInFirst") };
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      reported_item_id: item.id,
      reason,
      description: description || null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  };

  const submitCommentReport = async (
    reason: ReportReason,
    description: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!userId || !reportTargetComment) {
      return { ok: false, error: t("alert.pleaseSignInFirst") };
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      reported_comment_id: reportTargetComment.id,
      reason,
      description: description || null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const blockUser = async (blockedId: string) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }
    if (blockedId === userId) {
      Alert.alert(t("alert.blockError"), t("alert.blockSelf"));
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      blocker_id: userId,
      blocked_id: blockedId,
    });

    if (error) {
      if (error.code === "23505") {
        Alert.alert(t("alert.blocked"), t("alert.alreadyBlocked"));
        return;
      }
      Alert.alert(t("alert.blockError"), error.message);
      return;
    }

    Alert.alert(t("alert.blocked"), t("alert.userBlocked"));
  };

  const handleOpenMoreMenu = (item: Item) => {
    Alert.alert(t("alert.itemMenu"), `@${item.owner.handle}`, [
      {
        text: t("feed.report"),
        onPress: () => setReportTargetItem(item),
      },
      {
        text: t("feed.blockUser"),
        onPress: () => void blockUser(item.owner_id),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const handleEditItem = (item: Item) => {
    const parentNav = navigation.getParent<any>();
    parentNav?.navigate("Add", { screen: "AddItemHome", params: { editItem: item } });
  };

  const formatCommentTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const loadCommentsForItem = async (itemId: string) => {
    setCommentsLoadingByItem((prev) => ({ ...prev, [itemId]: true }));

    let rows: FeedCommentRow[] = [];
    const withParentRes = await supabase
      .from("comments")
      .select("id,item_id,user_id,content,created_at,parent_id")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });

    if (withParentRes.error && withParentRes.error.message.toLowerCase().includes("parent_id")) {
      const fallbackRes = await supabase
        .from("comments")
        .select("id,item_id,user_id,content,created_at")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (fallbackRes.error) {
        setCommentsLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
        Alert.alert(t("alert.commentLoadError"), fallbackRes.error.message);
        return;
      }
      rows = (fallbackRes.data ?? []).map((row) => ({ ...row, parent_id: null })) as FeedCommentRow[];
    } else if (withParentRes.error) {
      setCommentsLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
      Alert.alert(t("alert.commentLoadError"), withParentRes.error.message);
      return;
    } else {
      rows = (withParentRes.data ?? []) as FeedCommentRow[];
    }

    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const commentIds = rows.map((row) => row.id);
    const [profilesRes, likesRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id,handle,display_name,avatar_url").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length > 0
        ? supabase.from("comment_likes").select("comment_id,user_id").in("comment_id", commentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    setCommentsLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
    if (profilesRes.error || likesRes.error) {
      Alert.alert(t("alert.commentLoadError"), profilesRes.error?.message ?? likesRes.error?.message ?? t("common.unknownError"));
      return;
    }

    const profileMap = new Map(
      (profilesRes.data ?? []).map((profile) => [profile.id, profile])
    );

    const likeCountByComment = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const like of likesRes.data ?? []) {
      likeCountByComment.set(like.comment_id, (likeCountByComment.get(like.comment_id) ?? 0) + 1);
      if (userId && like.user_id === userId) likedByMe.add(like.comment_id);
    }

    const mapped: FeedCommentView[] = rows.map((row) => {
      const p = profileMap.get(row.user_id);
      return {
        ...row,
        like_count: likeCountByComment.get(row.id) ?? 0,
        is_liked: likedByMe.has(row.id),
        user: {
          id: row.user_id,
          handle: p?.handle ?? "unknown",
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        },
      };
    });

    setCommentsByItem((prev) => ({ ...prev, [itemId]: mapped }));
  };

  const handleToggleCommentLike = async (itemId: string, commentId: string, isLiked: boolean) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }
    setCommentLikeLoadingById((prev) => ({ ...prev, [commentId]: true }));
    const { error } = isLiked
      ? await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId)
      : await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    setCommentLikeLoadingById((prev) => ({ ...prev, [commentId]: false }));
    if (error) {
      Alert.alert(t("alert.commentLikeError"), error.message);
      return;
    }

    setCommentsByItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              is_liked: !isLiked,
              like_count: isLiked ? Math.max(0, comment.like_count - 1) : comment.like_count + 1,
            }
          : comment
      ),
    }));
  };

  const handleSubmitComment = async (item: Item) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }
    const itemId = item.id;
    const content = (commentDraftByItem[itemId] ?? "").trim();
    if (!content) return;

    const replyTarget = replyToCommentByItem[itemId] ?? null;
    setCommentActionLoadingByItem((prev) => ({ ...prev, [itemId]: true }));

    let insertRes = await supabase.from("comments").insert({
      item_id: itemId,
      user_id: userId,
      content,
      parent_id: replyTarget?.id ?? null,
    });

    if (insertRes.error && insertRes.error.message.toLowerCase().includes("parent_id")) {
      const fallbackContent = replyTarget ? `@${replyTarget.user.handle} ${content}` : content;
      insertRes = await supabase.from("comments").insert({
        item_id: itemId,
        user_id: userId,
        content: fallbackContent,
      });
    }

    setCommentActionLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
    if (insertRes.error) {
      Alert.alert(t("alert.commentError"), insertRes.error.message);
      return;
    }

    setCommentDraftByItem((prev) => ({ ...prev, [itemId]: "" }));
    setReplyToCommentByItem((prev) => ({ ...prev, [itemId]: null }));
    setItems((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, comment_count: (entry.comment_count ?? 0) + 1 } : entry)));
    await loadCommentsForItem(itemId);
  };

  const startEditComment = (itemId: string, comment: FeedCommentView) => {
    setEditingCommentIdByItem((prev) => ({ ...prev, [itemId]: comment.id }));
    setEditingCommentDraftByItem((prev) => ({ ...prev, [itemId]: comment.content }));
  };

  const cancelEditComment = (itemId: string) => {
    setEditingCommentIdByItem((prev) => ({ ...prev, [itemId]: null }));
    setEditingCommentDraftByItem((prev) => ({ ...prev, [itemId]: "" }));
  };

  const submitEditComment = async (itemId: string, commentId: string) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }
    const nextContent = (editingCommentDraftByItem[itemId] ?? "").trim();
    if (!nextContent) return;

    setCommentMutatingById((prev) => ({ ...prev, [commentId]: true }));
    const { error } = await supabase
      .from("comments")
      .update({ content: nextContent })
      .eq("id", commentId)
      .eq("user_id", userId);
    setCommentMutatingById((prev) => ({ ...prev, [commentId]: false }));

    if (error) {
      Alert.alert(t("alert.commentEditError"), error.message);
      return;
    }

    setCommentsByItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map((comment) =>
        comment.id === commentId ? { ...comment, content: nextContent } : comment
      ),
    }));
    cancelEditComment(itemId);
  };

  const handleDeleteComment = async (item: Item, comment: FeedCommentView) => {
    if (!userId) {
      Alert.alert(t("alert.authRequired"), t("alert.pleaseSignInFirst"));
      return;
    }

    const canDelete = comment.user.id === userId || item.owner_id === userId;
    if (!canDelete) {
      Alert.alert(t("alert.deleteError"), t("feed.noDeletePermission"));
      return;
    }

    setCommentMutatingById((prev) => ({ ...prev, [comment.id]: true }));
    const { error } = await supabase.rpc("delete_comment_with_policy", {
      p_comment_id: comment.id,
    });
    setCommentMutatingById((prev) => ({ ...prev, [comment.id]: false }));
    if (error) {
      Alert.alert(t("alert.commentDeleteError"), error.message);
      return;
    }

    await loadCommentsForItem(item.id);
    const { count } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("item_id", item.id);
    setItems((prevItems) =>
      prevItems.map((entry) =>
        entry.id === item.id
          ? { ...entry, comment_count: count ?? entry.comment_count }
          : entry
      )
    );

    if (replyToCommentByItem[item.id]?.id === comment.id) {
      setReplyToCommentByItem((prev) => ({ ...prev, [item.id]: null }));
    }
    if (editingCommentIdByItem[item.id] === comment.id) {
      cancelEditComment(item.id);
    }
  };

  const openCommentUserProfile = (comment: FeedCommentView) => {
    navigation.navigate("UserProfile", {
      ownerId: comment.user.id,
      handle: comment.user.handle,
    });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId((prev) => {
      const next = prev === itemId ? null : itemId;
      if (next && !commentsByItem[itemId]) {
        void loadCommentsForItem(itemId);
      }
      return next;
    });
  };

  const openImageViewer = (uri: string) => {
    setViewerImageUri(uri);
  };

  const closeImageViewer = () => {
    setViewerImageUri(null);
  };

  const getCategoryLabel = (id: string) => {
    if (id === "all") return t("feed.category.all");
    if (id === "luxury") return t("feed.category.luxury");
    if (id === "accessories") return t("feed.category.accessories");
    if (id === "cars") return t("feed.category.cars");
    return t("feed.category.realEstate");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          accessibilityLabel={t("feed.title")}
          resizeMode="contain"
          source={resolvedTheme === "dark" ? LOGO_DARK : LOGO_LIGHT}
          style={styles.headerLogo}
        />
        <View style={styles.topRightActions}>
          <Pressable
            accessibilityLabel="DM"
            onPress={() => navigation.navigate("DMInbox")}
            style={styles.iconButton}
          >
            <DmIcon />
          </Pressable>
          <Pressable
            accessibilityLabel="History"
            onPress={() => navigation.navigate("NotificationsHome")}
            style={styles.iconButton}
          >
            <HistoryIcon />
            {notificationUnreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.categoryScroller}
        contentContainerStyle={styles.categoryList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {CATEGORIES.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedCategory(item.id)}
            style={[styles.categoryButton, selectedCategory === item.id && styles.categoryButtonActive]}
          >
            <Text style={[styles.categoryLabel, selectedCategory === item.id && styles.categoryLabelActive]}>
              {getCategoryLabel(item.id)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {itemsLoading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loader} /> : null}
        ListEmptyComponent={<Text style={styles.emptyText}>{t("feed.emptyItems")}</Text>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        style={styles.list}
        renderItem={({ item }) => {
          const isExpanded = expandedItemId === item.id;
          const sameHandle =
            userHandle != null &&
            item.owner.handle != null &&
            item.owner.handle.toLowerCase() === userHandle.toLowerCase();
          const isOwnItem = (userId != null && item.owner_id === userId) || sameHandle;
          const canShowViewProfile = !isOwnItem;
          const cardImages =
            item.image_urls && item.image_urls.length > 0
              ? item.image_urls.filter(Boolean)
              : item.image_url
                ? [item.image_url]
                : [];
          const currentImageIndex = cardImageIndexById[item.id] ?? 0;
          return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.ownerRow}>
                {item.owner.avatar_url ? (
                  <Image source={{ uri: item.owner.avatar_url }} style={styles.ownerAvatar} />
                ) : (
                  <View style={styles.ownerAvatarFallback}>
                    <Text style={styles.ownerAvatarFallbackText}>
                      {(item.owner.display_name ?? item.owner.handle).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.ownerHandle}>@{item.owner.handle}</Text>
              </View>
              <View style={styles.headerRightRow}>
                {canShowViewProfile ? (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("UserProfile", {
                        ownerId: item.owner_id,
                        handle: item.owner.handle,
                      })
                    }
                  >
                    <Text style={styles.viewProfile}>{t("feed.viewProfile")}</Text>
                  </Pressable>
                ) : null}
                {isOwnItem ? (
                  <Pressable onPress={() => handleEditItem(item)}>
                    <Text style={styles.viewProfile}>{t("feed.edit")}</Text>
                  </Pressable>
                ) : null}
                {canShowViewProfile ? (
                  <Pressable onPress={() => handleOpenMoreMenu(item)} style={styles.moreButton}>
                    <Text style={styles.moreButtonText}>•••</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View
              onLayout={(event) => {
                const width = Math.round(event.nativeEvent.layout.width);
                if (!width) return;
                setCardImageWidthById((prev) => (prev[item.id] === width ? prev : { ...prev, [item.id]: width }));
              }}
              style={styles.cardImageSliderWrap}
            >
              {cardImages.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const trackWidth = cardImageWidthById[item.id] ?? event.nativeEvent.layoutMeasurement.width ?? 1;
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(trackWidth, 1));
                    setCardImageIndexById((prev) => ({ ...prev, [item.id]: nextIndex }));
                  }}
                >
                  {cardImages.map((uri, index) => (
                    <Pressable
                      key={`${item.id}-${index}`}
                      onPress={() => openImageViewer(uri)}
                      style={[
                        styles.cardImageSlide,
                        { width: cardImageWidthById[item.id] ?? 320 },
                      ]}
                    >
                      <Image source={{ uri }} style={styles.cardImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.imageFallback}>
                  <Text style={styles.imageFallbackText}>{t("feed.noImage")}</Text>
                </View>
              )}
              {cardImages.length > 1 ? (
                <View style={styles.cardImageDots}>
                  {cardImages.map((_, index) => (
                    <View
                      key={`${item.id}-dot-${index}`}
                      style={[
                        styles.cardImageDot,
                        index === currentImageIndex ? styles.cardImageDotActive : null,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => toggleExpanded(item.id)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.category ?? "Uncategorized"}
                {item.brand ? ` | ${item.brand}` : ""}
              </Text>
            </Pressable>
            <Pressable onPress={() => toggleExpanded(item.id)} style={styles.expandToggle}>
              <Text style={styles.expandToggleText}>{isExpanded ? "Hide details" : "View details"}</Text>
            </Pressable>
            {isExpanded && item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable
                disabled={Boolean(actionLoading[item.id])}
                onPress={() => void handleLikeToggle(item.id, Boolean(item.liked))}
                style={styles.actionButton}
              >
                <Text style={[styles.actionIcon, item.liked && styles.actionIconActive]}>
                  {item.liked ? "♥" : "♡"}
                </Text>
                <Text style={styles.actionText}>{item.like_count ?? 0}</Text>
              </Pressable>
              <Pressable onPress={() => toggleExpanded(item.id)} style={styles.actionButton}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionText}>{item.comment_count ?? 0}</Text>
              </Pressable>
              <Pressable onPress={() => setShareItem(item)} style={styles.actionButton}>
                <ShareActionIcon />
              </Pressable>
              <View style={styles.actionRowSpacer} />
              <Pressable
                disabled={Boolean(actionLoading[item.id])}
                onPress={() => void handleBookmarkToggle(item.id, Boolean(item.bookmarked))}
                style={styles.actionButton}
              >
                <BookmarkActionIcon active={Boolean(item.bookmarked)} />
              </Pressable>
            </View>
            {isExpanded ? (
              <View style={styles.commentPreviewWrap}>
                {replyToCommentByItem[item.id] ? (
                  <View style={styles.replyingRow}>
                    <Text style={styles.replyingText}>
                      {t("feed.replyingTo", { handle: replyToCommentByItem[item.id]?.user.handle ?? "" })}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setReplyToCommentByItem((prev) => ({
                          ...prev,
                          [item.id]: null,
                        }))
                      }
                    >
                      <Text style={styles.replyCancelText}>{t("common.cancel")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.commentComposerRow}>
                  <TextInput
                    multiline
                    onChangeText={(value) => setCommentDraftByItem((prev) => ({ ...prev, [item.id]: value }))}
                    placeholder={t("feed.writeComment")}
                    placeholderTextColor={webUi.color.placeholder}
                    style={styles.commentComposerInput}
                    value={commentDraftByItem[item.id] ?? ""}
                  />
                  <Pressable
                    disabled={Boolean(commentActionLoadingByItem[item.id])}
                    onPress={() => void handleSubmitComment(item)}
                    style={styles.commentComposerButton}
                  >
                    <Text style={styles.commentComposerButtonText}>
                      {commentActionLoadingByItem[item.id] ? "..." : t("feed.post")}
                    </Text>
                  </Pressable>
                </View>

                {commentsLoadingByItem[item.id] ? <ActivityIndicator style={styles.loader} /> : null}

                {(commentsByItem[item.id] ?? []).filter((comment) => !comment.parent_id).map((comment) => {
                  const replies = (commentsByItem[item.id] ?? []).filter((entry) => entry.parent_id === comment.id);
                  const isEditing = editingCommentIdByItem[item.id] === comment.id;
                  const deleted = isDeletedComment(comment.content);
                  const canDelete = !deleted && userId != null && (comment.user.id === userId || item.owner_id === userId);
                  const canEdit = !deleted && userId != null && comment.user.id === userId;
                  return (
                    <View key={comment.id} style={styles.commentListItem}>
                      <View style={styles.commentTopRow}>
                        <Pressable onPress={() => openCommentUserProfile(comment)}>
                          <Text style={styles.commentPreviewAuthor}>@{comment.user.handle}</Text>
                        </Pressable>
                        <Text style={styles.commentTimeText}>{formatCommentTime(comment.created_at)}</Text>
                      </View>
                      {isEditing ? (
                        <View style={styles.commentEditRow}>
                          <TextInput
                            multiline
                            onChangeText={(value) =>
                              setEditingCommentDraftByItem((prev) => ({
                                ...prev,
                                [item.id]: value,
                              }))
                            }
                            placeholder={t("feed.editComment")}
                            placeholderTextColor={webUi.color.placeholder}
                            style={styles.commentEditInput}
                            value={editingCommentDraftByItem[item.id] ?? ""}
                          />
                          <View style={styles.commentEditActionRow}>
                            <Pressable
                              disabled={Boolean(commentMutatingById[comment.id])}
                              onPress={() => cancelEditComment(item.id)}
                            >
                              <Text style={styles.commentReplyText}>{t("common.cancel")}</Text>
                            </Pressable>
                            <Pressable
                              disabled={Boolean(commentMutatingById[comment.id])}
                              onPress={() => void submitEditComment(item.id, comment.id)}
                            >
                              <Text style={styles.commentLikeTextActive}>
                                {commentMutatingById[comment.id] ? "..." : t("feed.save")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.commentPreviewText}>{getCommentDisplayContent(comment.content)}</Text>
                      )}
                      <View style={styles.commentActionRow}>
                        <Pressable
                          disabled={Boolean(commentLikeLoadingById[comment.id])}
                          onPress={() => void handleToggleCommentLike(item.id, comment.id, comment.is_liked)}
                        >
                          <Text style={[styles.commentLikeText, comment.is_liked ? styles.commentLikeTextActive : null]}>
                            ♥ {comment.like_count}
                          </Text>
                        </Pressable>
                        {!deleted ? (
                          <Pressable
                            onPress={() =>
                              setReplyToCommentByItem((prev) => ({
                                ...prev,
                                [item.id]: comment,
                              }))
                            }
                          >
                            <Text style={styles.commentReplyText}>{t("feed.reply")}</Text>
                          </Pressable>
                        ) : null}
                        {canEdit ? (
                          <Pressable onPress={() => startEditComment(item.id, comment)}>
                            <Text style={styles.commentReplyText}>{t("feed.edit")}</Text>
                          </Pressable>
                        ) : null}
                        {canDelete ? (
                          <Pressable
                            disabled={Boolean(commentMutatingById[comment.id])}
                            onPress={() => void handleDeleteComment(item, comment)}
                          >
                            <Text style={styles.commentDeleteText}>
                              {commentMutatingById[comment.id] ? "..." : t("feed.delete")}
                            </Text>
                          </Pressable>
                        ) : null}
                        {userId != null && userId !== comment.user.id ? (
                          <Pressable
                            onPress={() =>
                              setReportTargetComment({
                                id: comment.id,
                                handle: comment.user.handle,
                              })
                            }
                          >
                            <Text style={styles.commentReplyText}>{t("feed.report")}</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {replies.map((reply) => (
                        (() => {
                          const isEditingReply = editingCommentIdByItem[item.id] === reply.id;
                          const replyDeleted = isDeletedComment(reply.content);
                          return (
                            <View key={reply.id} style={styles.replyThreadRow}>
                              <Text style={styles.replyArrow}>↳</Text>
                              <View style={styles.replyListItem}>
                                <View style={styles.commentTopRow}>
                                  <Pressable onPress={() => openCommentUserProfile(reply)}>
                                    <Text style={styles.commentPreviewAuthor}>@{reply.user.handle}</Text>
                                  </Pressable>
                                  <Text style={styles.commentTimeText}>{formatCommentTime(reply.created_at)}</Text>
                                </View>
                                {isEditingReply ? (
                                  <View style={styles.commentEditRow}>
                                    <TextInput
                                      multiline
                                      onChangeText={(value) =>
                                        setEditingCommentDraftByItem((prev) => ({
                                          ...prev,
                                          [item.id]: value,
                                        }))
                                      }
                                      placeholder={t("feed.editReply")}
                                      placeholderTextColor={webUi.color.placeholder}
                                      style={styles.commentEditInput}
                                      value={editingCommentDraftByItem[item.id] ?? ""}
                                    />
                                    <View style={styles.commentEditActionRow}>
                                      <Pressable
                                        disabled={Boolean(commentMutatingById[reply.id])}
                                        onPress={() => cancelEditComment(item.id)}
                                      >
                                        <Text style={styles.commentReplyText}>{t("common.cancel")}</Text>
                                      </Pressable>
                                      <Pressable
                                        disabled={Boolean(commentMutatingById[reply.id])}
                                        onPress={() => void submitEditComment(item.id, reply.id)}
                                      >
                                        <Text style={styles.commentLikeTextActive}>
                                          {commentMutatingById[reply.id] ? "..." : t("feed.save")}
                                        </Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                ) : (
                                  <Text style={styles.commentPreviewText}>{getCommentDisplayContent(reply.content)}</Text>
                                )}
                                <View style={styles.commentActionRow}>
                                  <Pressable
                                    disabled={Boolean(commentLikeLoadingById[reply.id])}
                                    onPress={() => void handleToggleCommentLike(item.id, reply.id, reply.is_liked)}
                                  >
                                    <Text style={[styles.commentLikeText, reply.is_liked ? styles.commentLikeTextActive : null]}>
                                      ♥ {reply.like_count}
                                    </Text>
                                  </Pressable>
                                  {userId != null && reply.user.id === userId && !replyDeleted ? (
                                    <Pressable onPress={() => startEditComment(item.id, reply)}>
                                      <Text style={styles.commentReplyText}>{t("feed.edit")}</Text>
                                    </Pressable>
                                  ) : null}
                                  {userId != null && (reply.user.id === userId || item.owner_id === userId) && !replyDeleted ? (
                                    <Pressable
                                      disabled={Boolean(commentMutatingById[reply.id])}
                                      onPress={() => void handleDeleteComment(item, reply)}
                                    >
                                      <Text style={styles.commentDeleteText}>
                                        {commentMutatingById[reply.id] ? "..." : t("feed.delete")}
                                      </Text>
                                    </Pressable>
                                  ) : null}
                                  {userId != null && userId !== reply.user.id ? (
                                    <Pressable
                                      onPress={() =>
                                        setReportTargetComment({
                                          id: reply.id,
                                          handle: reply.user.handle,
                                        })
                                      }
                                    >
                                      <Text style={styles.commentReplyText}>{t("feed.report")}</Text>
                                    </Pressable>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          );
                        })()
                      ))}
                    </View>
                  );
                })}

                {(commentsByItem[item.id] ?? []).length === 0 && !commentsLoadingByItem[item.id] ? (
                  <Text style={styles.viewAllCommentsText}>{t("feed.noComments")}</Text>
                ) : null}
              </View>
            ) : item.comment_preview && item.comment_preview.some((comment) => !isDeletedComment(comment.content)) ? (
              <View style={styles.commentPreviewWrap}>
                {item.comment_preview
                  .filter((comment) => !isDeletedComment(comment.content))
                  .map((comment) => (
                  <Text key={comment.id} numberOfLines={1} style={styles.commentPreviewText}>
                    <Text style={styles.commentPreviewAuthor}>
                      @{comment.user_handle}
                    </Text>{" "}
                    {comment.content}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          );
        }}
      />
      <ReportModal
        onClose={() => setReportTargetItem(null)}
        onSubmit={(reason, description) =>
          reportTargetItem
            ? submitItemReport(reportTargetItem, reason, description)
            : Promise.resolve({ ok: false, error: t("feed.missingReportTarget") })
        }
        targetName={reportTargetItem ? `@${reportTargetItem.owner.handle}` : ""}
        visible={Boolean(reportTargetItem)}
      />
      <ReportModal
        onClose={() => setReportTargetComment(null)}
        onSubmit={submitCommentReport}
        targetName={reportTargetComment ? `@${reportTargetComment.handle} ${t("feed.commentTargetSuffix")}` : ""}
        visible={Boolean(reportTargetComment)}
      />
      <Modal animationType="fade" onRequestClose={closeImageViewer} transparent visible={Boolean(viewerImageUri)}>
        <View style={styles.viewerBackdrop}>
          <Pressable onPress={closeImageViewer} style={styles.viewerCloseButton}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
          {viewerImageUri ? (
            <Pressable onPress={closeImageViewer} style={styles.viewerImageWrap}>
              <Image resizeMode="contain" source={{ uri: viewerImageUri }} style={styles.viewerImage} />
            </Pressable>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setShareItem(null)}
        transparent
        visible={Boolean(shareItem)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setShareItem(null)} style={styles.sheetBackdropDismiss} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("feed.share")}</Text>
            <Pressable
              onPress={() => {
                const item = shareItem;
                setShareItem(null);
                if (item) void handleUrlShare(item);
              }}
              style={styles.sheetActionButton}
            >
              <Text style={styles.sheetActionText}>{t("feed.shareUrl")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const item = shareItem;
                setShareItem(null);
                if (item) void handleDmShare(item);
              }}
              style={styles.sheetActionButton}
            >
              <Text style={styles.sheetActionText}>{t("feed.shareToDm")}</Text>
            </Pressable>
            <Pressable onPress={() => setShareItem(null)} style={styles.sheetCancelButton}>
              <Text style={styles.sheetCancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShareFollowersVisible(false);
          setDmShareItem(null);
        }}
        transparent
        visible={shareFollowersVisible}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            onPress={() => {
              setShareFollowersVisible(false);
              setDmShareItem(null);
            }}
            style={styles.sheetBackdropDismiss}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("feed.selectFollower")}</Text>
            {shareFollowersLoading ? <ActivityIndicator style={styles.loader} /> : null}
            <FlatList
              data={shareFollowers}
              keyExtractor={(item) => item.id}
              style={styles.shareFollowerList}
              ListEmptyComponent={<Text style={styles.emptyText}>{t("feed.noFollowers")}</Text>}
              renderItem={({ item }) => (
                <Pressable
                  disabled={shareSendingToId === item.id}
                  onPress={() => void shareItemToFollower(item)}
                  style={styles.shareFollowerRow}
                >
                  <View style={styles.shareFollowerAvatarWrap}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.shareFollowerAvatar} />
                    ) : (
                      <Text style={styles.shareFollowerAvatarText}>
                        {(item.display_name ?? item.handle).slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.shareFollowerMeta}>
                    <Text style={styles.shareFollowerName}>{item.display_name ?? item.handle}</Text>
                    <Text style={styles.shareFollowerHandle}>@{item.handle}</Text>
                  </View>
                  <Text style={styles.shareFollowerAction}>
                    {shareSendingToId === item.id ? "..." : t("feed.send")}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => {
                setShareFollowersVisible(false);
                setDmShareItem(null);
              }}
              style={styles.sheetCancelButton}
            >
              <Text style={styles.sheetCancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  categoryList: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  categoryScroller: {
    maxHeight: 42,
  },
  categoryButton: {
    alignSelf: "flex-start",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryButtonActive: {
    backgroundColor: "#E5E5E5",
  },
  categoryLabel: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryLabelActive: {
    color: "#000000",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: webUi.color.text,
    fontSize: webUi.typography.pageTitle,
    fontWeight: "700",
  },
  headerLogo: {
    height: 28,
    width: 28,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  topRightActions: {
    flexDirection: "row",
    gap: 8,
  },
  notificationBadge: {
    alignItems: "center",
    backgroundColor: webUi.color.danger,
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: -5,
    top: -5,
  },
  notificationBadgeText: {
    color: webUi.color.primaryText,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 14,
  },
  loader: {
    marginTop: 8,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
    paddingTop: 4,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: webUi.color.textMuted,
    paddingTop: 24,
    textAlign: "center",
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ownerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  ownerAvatar: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  ownerAvatarFallback: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  ownerAvatarFallbackText: {
    color: webUi.color.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  ownerHandle: {
    color: webUi.color.text,
    fontSize: 12,
    fontWeight: "600",
  },
  headerRightRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  viewProfile: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    color: webUi.color.textSecondary,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moreButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 28,
  },
  moreButtonText: {
    color: webUi.color.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
    lineHeight: 11,
  },
  cardImageSliderWrap: {
    position: "relative",
  },
  cardImageSlide: {
    width: "100%",
  },
  cardImage: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: webUi.radius.xl,
    height: 220,
    width: "100%",
  },
  cardImageDots: {
    alignSelf: "center",
    backgroundColor: webUi.color.overlaySoft,
    borderRadius: 999,
    bottom: 8,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
  },
  cardImageDot: {
    backgroundColor: webUi.color.overlayDot,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  cardImageDotActive: {
    backgroundColor: webUi.color.primaryText,
  },
  imageFallback: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: webUi.radius.xl,
    height: 220,
    justifyContent: "center",
  },
  imageFallbackText: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  cardTitle: {
    color: webUi.color.text,
    fontSize: 17,
    fontWeight: "700",
  },
  cardMeta: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  cardDescription: {
    color: webUi.color.textSecondary,
    lineHeight: 20,
  },
  expandToggle: {
    alignSelf: "flex-start",
    marginTop: -4,
  },
  expandToggleText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    borderTopColor: webUi.color.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  actionRowSpacer: {
    flex: 1,
  },
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  actionIcon: {
    color: webUi.color.textSecondary,
    fontSize: 13,
  },
  actionIconActive: {
    color: webUi.color.primary,
  },
  actionText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  commentPreviewWrap: {
    borderTopColor: webUi.color.border,
    borderTopWidth: 1,
    gap: 4,
    marginTop: 2,
    paddingTop: 10,
  },
  replyingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  replyingText: {
    color: webUi.color.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  replyCancelText: {
    color: webUi.color.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  commentComposerRow: {
    gap: 6,
    marginBottom: 6,
  },
  commentComposerInput: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  commentComposerButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: webUi.color.primary,
    borderRadius: webUi.radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  commentComposerButtonText: {
    color: webUi.color.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  commentListItem: {
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    gap: 4,
    padding: 8,
  },
  replyListItem: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    padding: 8,
    flex: 1,
  },
  replyThreadRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  replyArrow: {
    color: webUi.color.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    marginLeft: 2,
    marginTop: 2,
  },
  commentTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  commentTimeText: {
    color: webUi.color.textMuted,
    fontSize: 10,
  },
  commentActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  commentEditRow: {
    gap: 6,
    marginTop: 2,
  },
  commentEditInput: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  commentEditActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  commentLikeText: {
    color: webUi.color.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  commentLikeTextActive: {
    color: webUi.color.primary,
  },
  commentReplyText: {
    color: webUi.color.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  commentDeleteText: {
    color: webUi.color.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  commentPreviewText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
  },
  commentPreviewAuthor: {
    color: webUi.color.text,
    fontWeight: "700",
  },
  viewAllCommentsText: {
    color: webUi.color.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  viewerBackdrop: {
    backgroundColor: webUi.color.overlayStrong,
    flex: 1,
    justifyContent: "center",
  },
  viewerCloseButton: {
    alignItems: "center",
    position: "absolute",
    right: 18,
    top: 42,
    zIndex: 2,
  },
  viewerCloseText: {
    color: webUi.color.primaryText,
    fontSize: 28,
    fontWeight: "700",
  },
  viewerImageWrap: {
    flex: 1,
    justifyContent: "center",
  },
  viewerImage: {
    height: "100%",
    width: "100%",
  },
  sheetBackdrop: {
    backgroundColor: webUi.color.overlaySoft,
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdropDismiss: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: webUi.color.surface,
    borderTopLeftRadius: webUi.radius.xxl,
    borderTopRightRadius: webUi.radius.xxl,
    gap: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: webUi.color.border,
    borderRadius: 999,
    height: 4,
    marginBottom: 2,
    width: 48,
  },
  sheetTitle: {
    color: webUi.color.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
  },
  sheetActionButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingVertical: 12,
  },
  sheetActionText: {
    color: webUi.color.text,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetCancelButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    marginTop: 2,
    paddingVertical: 12,
  },
  sheetCancelText: {
    color: webUi.color.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  shareFollowerList: {
    maxHeight: 320,
  },
  shareFollowerRow: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  shareFollowerAvatarWrap: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    overflow: "hidden",
    width: 34,
  },
  shareFollowerAvatar: {
    height: "100%",
    width: "100%",
  },
  shareFollowerAvatarText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  shareFollowerMeta: {
    flex: 1,
  },
  shareFollowerName: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "700",
  },
  shareFollowerHandle: {
    color: webUi.color.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  shareFollowerAction: {
    color: webUi.color.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
