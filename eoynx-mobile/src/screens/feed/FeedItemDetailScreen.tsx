import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportModal, type ReportReason } from "../../components/ReportModal";
import { supabase } from "../../lib/supabase";
import type { FeedStackParamList } from "../../navigation/types";
import { webUi } from "../../theme/webUi";

type Props = NativeStackScreenProps<FeedStackParamList, "FeedItemDetail">;

type CommentRow = {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ProfileLookup = {
  display_name: string | null;
  handle: string;
  id: string;
};

export function FeedItemDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const imageScrollRef = useRef<ScrollView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLookup>>({});
  const [commentInput, setCommentInput] = useState("");
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    void loadDetailData();
  }, []);

  const loadDetailData = async () => {
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setLoading(false);
      Alert.alert("Auth Error", authError.message);
      return;
    }

    const uid = authData.user?.id ?? null;
    setUserId(uid);

    const [likesCountRes, likedRes, bookmarkedRes, commentsRes] = await Promise.all([
      supabase.from("likes").select("id", { count: "exact", head: true }).eq("item_id", item.id),
      uid
        ? supabase.from("likes").select("id").eq("item_id", item.id).eq("user_id", uid).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      uid
        ? supabase.from("bookmarks").select("id").eq("item_id", item.id).eq("user_id", uid).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("comments")
        .select("id,item_id,user_id,content,created_at")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false }),
    ]);

    setLoading(false);

    if (likesCountRes.error || likedRes.error || bookmarkedRes.error || commentsRes.error) {
      Alert.alert(
        "Load Error",
        likesCountRes.error?.message ??
          likedRes.error?.message ??
          bookmarkedRes.error?.message ??
          commentsRes.error?.message ??
          "Unknown error"
      );
      return;
    }

    const nextComments = commentsRes.data ?? [];
    setLikeCount(likesCountRes.count ?? 0);
    setLiked(Boolean(likedRes.data));
    setBookmarked(Boolean(bookmarkedRes.data));
    setComments(nextComments);

    const uniqueUserIds = Array.from(new Set(nextComments.map((c) => c.user_id)));
    if (uniqueUserIds.length === 0) {
      setProfilesMap({});
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id,handle,display_name")
      .in("id", uniqueUserIds);

    if (profilesError) {
      Alert.alert("Profile Error", profilesError.message);
      return;
    }

    const map: Record<string, ProfileLookup> = {};
    for (const p of profilesData ?? []) {
      map[p.id] = p;
    }
    setProfilesMap(map);
  };

  const handleToggleLike = async () => {
    if (!userId) {
      Alert.alert("Auth Required", "Please sign in.");
      return;
    }
    setActionLoading(true);
    const { error } = liked
      ? await supabase.from("likes").delete().eq("item_id", item.id).eq("user_id", userId)
      : await supabase.from("likes").upsert({ item_id: item.id, user_id: userId }, { onConflict: "user_id,item_id" });
    setActionLoading(false);

    if (error) {
      Alert.alert("Like Error", error.message);
      return;
    }

    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
  };

  const handleToggleBookmark = async () => {
    if (!userId) {
      Alert.alert("Auth Required", "Please sign in.");
      return;
    }
    setActionLoading(true);
    const { error } = bookmarked
      ? await supabase.from("bookmarks").delete().eq("item_id", item.id).eq("user_id", userId)
      : await supabase
          .from("bookmarks")
          .upsert({ item_id: item.id, user_id: userId }, { onConflict: "user_id,item_id" });
    setActionLoading(false);

    if (error) {
      Alert.alert("Bookmark Error", error.message);
      return;
    }

    setBookmarked((prev) => !prev);
  };

  const handleAddComment = async () => {
    const content = commentInput.trim();
    if (!content) return;
    if (!userId) {
      Alert.alert("Auth Required", "Please sign in.");
      return;
    }

    setActionLoading(true);
    const { error } = await supabase.from("comments").insert({
      content,
      item_id: item.id,
      user_id: userId,
    });
    setActionLoading(false);

    if (error) {
      Alert.alert("Comment Error", error.message);
      return;
    }

    setCommentInput("");
    await loadDetailData();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!userId) return;
    setActionLoading(true);
    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", userId);
    setActionLoading(false);

    if (error) {
      Alert.alert("Delete Error", error.message);
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const submitItemReport = async (
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

  const blockUser = async () => {
    if (!userId) {
      Alert.alert("Auth Required", "Please sign in first.");
      return;
    }
    if (item.owner_id === userId) {
      Alert.alert("Block Error", "You cannot block yourself.");
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      blocker_id: userId,
      blocked_id: item.owner_id,
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

  const commentCount = comments.length;
  const createdAtText = useMemo(() => item.created_at ?? "-", [item.created_at]);
  const itemImages = useMemo(() => {
    if (item.image_urls && item.image_urls.length > 0) {
      return item.image_urls.filter(Boolean);
    }
    return item.image_url ? [item.image_url] : [];
  }, [item.image_url, item.image_urls]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [item.id]);

  const scrollToImage = (index: number) => {
    if (!itemImages.length || sliderWidth <= 0) return;
    const safeIndex = Math.max(0, Math.min(index, itemImages.length - 1));
    imageScrollRef.current?.scrollTo({ x: safeIndex * sliderWidth, animated: true });
    setCurrentImageIndex(safeIndex);
  };

  const handleEditItem = () => {
    const parentNav = navigation.getParent<any>();
    parentNav?.navigate("Add", { screen: "AddItemHome", params: { editItem: item } });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.itemHeaderRow}>
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
            {userId && item.owner_id === userId ? (
              <Pressable onPress={handleEditItem}>
                <Text style={styles.viewProfile}>Edit</Text>
              </Pressable>
            ) : null}
            {userId && item.owner_id !== userId ? (
              <Pressable
                onPress={() =>
                  Alert.alert("Item Menu", `@${item.owner.handle}`, [
                    {
                      text: "Report",
                      onPress: () => setReportModalVisible(true),
                    },
                    {
                      text: "Block User",
                      onPress: () => void blockUser(),
                    },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
                style={styles.moreButton}
              >
                <Text style={styles.moreButtonText}>•••</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {itemImages.length > 0 ? (
          <View
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              if (nextWidth > 0 && nextWidth !== sliderWidth) {
                setSliderWidth(nextWidth);
              }
            }}
            style={styles.imageSliderWrap}
          >
            <ScrollView
              horizontal
              pagingEnabled
              ref={imageScrollRef}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                if (sliderWidth <= 0) return;
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / sliderWidth);
                setCurrentImageIndex(nextIndex);
              }}
              style={styles.imageScroll}
            >
              {itemImages.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={[
                    styles.imageSlide,
                    sliderWidth > 0 ? { width: sliderWidth } : null,
                  ]}
                >
                  <Image source={{ uri }} style={styles.itemImage} />
                </View>
              ))}
            </ScrollView>

            {itemImages.length > 1 ? (
              <>
                <Pressable onPress={() => scrollToImage(currentImageIndex - 1)} style={[styles.imageNavButton, styles.imageNavLeft]}>
                  <Text style={styles.imageNavLabel}>‹</Text>
                </Pressable>
                <Pressable onPress={() => scrollToImage(currentImageIndex + 1)} style={[styles.imageNavButton, styles.imageNavRight]}>
                  <Text style={styles.imageNavLabel}>›</Text>
                </Pressable>
                <View style={styles.imageDotRow}>
                  {itemImages.map((_, index) => (
                    <View
                      key={`dot-${index}`}
                      style={[styles.imageDot, index === currentImageIndex ? styles.imageDotActive : null]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.category ?? "Uncategorized"}
          {item.brand ? ` | ${item.brand}` : ""}
        </Text>

        <View style={styles.actionRow}>
          <Pressable onPress={handleToggleLike} style={[styles.actionButton, liked && styles.actionButtonActive]}>
            <Text style={[styles.actionButtonLabel, liked && styles.actionButtonLabelActive]}>
              {liked ? "Liked" : "Like"} ({likeCount})
            </Text>
          </Pressable>
          <Pressable
            onPress={handleToggleBookmark}
            style={[styles.actionButton, bookmarked && styles.actionButtonActive]}
          >
            <Text style={[styles.actionButtonLabel, bookmarked && styles.actionButtonLabelActive]}>
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{item.description ?? "No description."}</Text>
        <Text style={styles.sectionTitle}>Created At</Text>
        <Text style={styles.body}>{createdAtText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Comments ({commentCount})</Text>
        <View style={styles.commentInputRow}>
          <TextInput
            multiline
            onChangeText={setCommentInput}
            placeholder="Write a comment..."
            style={styles.commentInput}
            value={commentInput}
          />
          <Pressable disabled={actionLoading} onPress={handleAddComment} style={styles.commentButton}>
            <Text style={styles.commentButtonLabel}>Post</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator /> : null}

        {comments.map((comment) => {
          const profile = profilesMap[comment.user_id];
          const author = profile?.display_name || (profile?.handle ? `@${profile.handle}` : comment.user_id.slice(0, 8));
          const canDelete = comment.user_id === userId;
          return (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{author}</Text>
                {canDelete ? (
                  <Pressable onPress={() => void handleDeleteComment(comment.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.commentContent}>{comment.content}</Text>
            </View>
          );
        })}
      </View>
      <ReportModal
        onClose={() => setReportModalVisible(false)}
        onSubmit={submitItemReport}
        targetName={`@${item.owner.handle}`}
        visible={reportModalVisible}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: 12,
    maxWidth: webUi.layout.pageMaxWidth,
    paddingBottom: 20,
    paddingTop: 4,
    width: "100%",
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  title: {
    color: webUi.color.text,
    fontSize: 22,
    fontWeight: "700",
  },
  itemHeaderRow: {
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
  itemImage: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: webUi.radius.xl,
    height: 240,
    width: "100%",
  },
  imageSliderWrap: {
    position: "relative",
  },
  imageScroll: {
    width: "100%",
  },
  imageSlide: {
    width: "100%",
  },
  imageNavButton: {
    alignItems: "center",
    backgroundColor: webUi.color.overlayMedium,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    marginTop: -14,
    position: "absolute",
    top: "50%",
    width: 28,
  },
  imageNavLeft: {
    left: 8,
  },
  imageNavRight: {
    right: 8,
  },
  imageNavLabel: {
    color: webUi.color.primaryText,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  imageDotRow: {
    alignSelf: "center",
    backgroundColor: webUi.color.overlaySoft,
    borderRadius: 999,
    bottom: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: "absolute",
  },
  imageDot: {
    backgroundColor: webUi.color.overlayDot,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  imageDotActive: {
    backgroundColor: webUi.color.primaryText,
  },
  meta: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionButtonActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  actionButtonLabel: {
    color: webUi.color.text,
    fontWeight: "700",
  },
  actionButtonLabelActive: {
    color: webUi.color.primaryText,
  },
  sectionHeader: {
    color: webUi.color.text,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionTitle: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    textTransform: "uppercase",
  },
  body: {
    color: webUi.color.textSecondary,
    lineHeight: 20,
  },
  commentInputRow: {
    gap: 8,
  },
  commentInput: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  commentButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: webUi.color.text,
    borderRadius: webUi.radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentButtonLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
  commentCard: {
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  commentHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  commentAuthor: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "700",
  },
  commentContent: {
    color: webUi.color.textSecondary,
    lineHeight: 18,
  },
  deleteText: {
    color: webUi.color.danger,
    fontSize: 12,
    fontWeight: "700",
  },
});
