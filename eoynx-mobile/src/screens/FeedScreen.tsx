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
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportModal, type ReportReason } from "../components/ReportModal";
import { useI18n } from "../i18n";
import { supabase } from "../lib/supabase";
import type { FeedStackParamList } from "../navigation/types";
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [cardImageIndexById, setCardImageIndexById] = useState<Record<string, number>>({});
  const [cardImageWidthById, setCardImageWidthById] = useState<Record<string, number>>({});
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
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
      Alert.alert("Load Error", error.message);
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
          "Load Error",
          likesRes.error?.message ??
            commentsRes.error?.message ??
            bookmarksRes.error?.message ??
            commentPreviewRes.error?.message ??
            "Unknown error"
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
        Alert.alert("Load Error", previewProfilesError.message);
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
      Alert.alert("Auth Required", "Please sign in first.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [itemId]: true }));
    const { error } = liked
      ? await supabase.from("likes").delete().eq("item_id", itemId).eq("user_id", userId)
      : await supabase.from("likes").upsert({ item_id: itemId, user_id: userId }, { onConflict: "user_id,item_id" });
    setActionLoading((prev) => ({ ...prev, [itemId]: false }));

    if (error) {
      Alert.alert("Like Error", error.message);
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
      Alert.alert("Auth Required", "Please sign in first.");
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
      Alert.alert("Bookmark Error", error.message);
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

  const handleShare = async (item: Item) => {
    const shareUrl = `https://eoynx.com/i/${item.id}`;
    try {
      await Share.share({
        message: `${item.title}\n${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert("Share Error", "Could not open share dialog.");
    }
  };

  const submitItemReport = async (
    item: Item,
    reason: ReportReason,
    description: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) {
      return { ok: false, error: "Please sign in first." };
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

  const blockUser = async (blockedId: string) => {
    if (!userId) {
      Alert.alert("Auth Required", "Please sign in first.");
      return;
    }
    if (blockedId === userId) {
      Alert.alert("Block Error", "You cannot block yourself.");
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      blocker_id: userId,
      blocked_id: blockedId,
    });

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Blocked", "This user is already blocked.");
        return;
      }
      Alert.alert("Block Error", error.message);
      return;
    }

    Alert.alert("Blocked", "User has been blocked.");
  };

  const handleOpenMoreMenu = (item: Item) => {
    Alert.alert("Item Menu", `@${item.owner.handle}`, [
      {
        text: "Report",
        onPress: () => setReportTargetItem(item),
      },
      {
        text: "Block User",
        onPress: () => void blockUser(item.owner_id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleEditItem = (item: Item) => {
    const parentNav = navigation.getParent<any>();
    parentNav?.navigate("Add", { screen: "AddItemHome", params: { editItem: item } });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
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
        <Text style={styles.title}>{t("feed.title")}</Text>
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
        ListEmptyComponent={<Text style={styles.emptyText}>No items found.</Text>}
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
                    <Text style={styles.viewProfile}>View Profile</Text>
                  </Pressable>
                ) : null}
                {isOwnItem ? (
                  <Pressable onPress={() => handleEditItem(item)}>
                    <Text style={styles.viewProfile}>Edit</Text>
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
                  <Text style={styles.imageFallbackText}>No image</Text>
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
              <Pressable onPress={() => void handleShare(item)} style={styles.actionButton}>
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
            {isExpanded && item.comment_preview && item.comment_preview.length > 0 ? (
              <View style={styles.commentPreviewWrap}>
                {item.comment_preview.map((comment) => (
                  <Text key={comment.id} numberOfLines={1} style={styles.commentPreviewText}>
                    <Text style={styles.commentPreviewAuthor}>
                      @{comment.user_handle}
                    </Text>{" "}
                    {comment.content}
                  </Text>
                ))}
                <Pressable onPress={() => toggleExpanded(item.id)}>
                  <Text style={styles.viewAllCommentsText}>
                    Hide comments
                  </Text>
                </Pressable>
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
            : Promise.resolve({ ok: false, error: "Missing report target." })
        }
        targetName={reportTargetItem ? `@${reportTargetItem.owner.handle}` : ""}
        visible={Boolean(reportTargetItem)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: 12,
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
    backgroundColor: webUi.color.text,
  },
  categoryLabel: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryLabelActive: {
    color: webUi.color.primaryText,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: webUi.color.text,
    fontSize: 24,
    fontWeight: "700",
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
});
