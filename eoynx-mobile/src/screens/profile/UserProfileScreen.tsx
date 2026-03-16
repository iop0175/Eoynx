import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getRequestErrorMessage, runRequestWithPolicy, type ApiErrorLike } from "../../lib/requestPolicy";
import { supabase } from "../../lib/supabase";
import { webUi } from "../../theme/webUi";
import type { Item } from "../../types/item";

type Props = {
  route: {
    params: {
      ownerId: string;
      handle: string;
    };
  };
};

type PublicProfile = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  dm_open?: boolean | null;
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
};

const CATEGORIES = [
  { id: "overall", label: "Overall" },
  { id: "luxury", label: "Luxury" },
  { id: "accessories", label: "Accessories" },
  { id: "cars", label: "Cars" },
];

export function UserProfileScreen({ route }: Props) {
  const language = "ko" as const;
  const navigation = useNavigation<any>();
  const { ownerId, handle } = route.params;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("overall");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: authData, error: authError } = await runRequestWithPolicy(() => supabase.auth.getUser());
    if (authError) {
      setLoading(false);
      Alert.alert("Load Error", getRequestErrorMessage(language, authError));
      return;
    }
    const uid = authData.user?.id ?? null;
    setViewerId(uid);

    const [profileRes, itemsRes, followersRes, followingRes, followStateRes] = await Promise.all([
      runRequestWithPolicy(() =>
        supabase
          .from("profiles")
          .select("id,handle,display_name,bio,avatar_url,dm_open")
          .eq("id", ownerId)
          .maybeSingle<PublicProfile>()
      ),
      runRequestWithPolicy(() =>
        supabase
          .from("items")
          .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at")
          .eq("owner_id", ownerId)
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(60)
          .returns<ItemRow[]>()
      ),
      runRequestWithPolicy(() =>
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("following_id", ownerId)
      ),
      runRequestWithPolicy(() =>
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("follower_id", ownerId)
      ),
      uid
        ? runRequestWithPolicy(() =>
            supabase.from("followers").select("id").eq("follower_id", uid).eq("following_id", ownerId).maybeSingle()
          )
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileRes.error || itemsRes.error || followersRes.error || followingRes.error || followStateRes.error) {
      setLoading(false);
      Alert.alert(
        "Load Error",
        getRequestErrorMessage(
          language,
          profileRes.error ?? itemsRes.error ?? followersRes.error ?? followingRes.error ?? followStateRes.error,
          "Unknown error"
        ),
      );
      return;
    }

    const rows = itemsRes.data ?? [];
    const itemIds = rows.map((row) => row.id);
    let likeCountByItem = new Map<string, number>();
    if (itemIds.length > 0) {
      const likesRes = await runRequestWithPolicy(() =>
        supabase.from("likes").select("item_id").in("item_id", itemIds)
      );

      if (likesRes.error) {
        setLoading(false);
        Alert.alert("Load Error", getRequestErrorMessage(language, likesRes.error, "Unknown error"));
        return;
      }

      likeCountByItem = new Map();
      for (const like of likesRes.data ?? []) {
        likeCountByItem.set(like.item_id, (likeCountByItem.get(like.item_id) ?? 0) + 1);
      }
    }

    const nextProfile = profileRes.data;
    setProfile(nextProfile);
    setFollowersCount(followersRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);
    setIsFollowing(Boolean(followStateRes.data));
    setItems(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        image_url: row.image_url,
        image_urls: row.image_urls,
        brand: row.brand,
        category: row.category,
        visibility: row.visibility,
        owner_id: row.owner_id,
        created_at: row.created_at,
        owner: {
          handle: nextProfile?.handle ?? handle,
          display_name: nextProfile?.display_name ?? null,
          avatar_url: nextProfile?.avatar_url ?? null,
        },
        like_count: likeCountByItem.get(row.id) ?? 0,
      })),
    );
    setLoading(false);
  }, [handle, language, ownerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "overall") return items;
    return items.filter((item) => (item.category ?? "").toLowerCase() === selectedCategory);
  }, [items, selectedCategory]);

  const isOwner = viewerId != null && viewerId === ownerId;

  const handleFollowToggle = async () => {
    if (!viewerId) {
      Alert.alert("Auth Required", "Please sign in first.");
      return;
    }
    setFollowLoading(true);
    let error: ApiErrorLike = null;
    try {
      const result = isFollowing
        ? await runRequestWithPolicy(() =>
            supabase.from("followers").delete().eq("follower_id", viewerId).eq("following_id", ownerId)
          )
        : await runRequestWithPolicy(() =>
            supabase
              .from("followers")
              .upsert({ follower_id: viewerId, following_id: ownerId }, { onConflict: "follower_id,following_id" })
          );
      error = result.error;
    } catch (followError) {
      error = followError as ApiErrorLike;
    }
    setFollowLoading(false);
    if (error) {
      Alert.alert("Follow Error", getRequestErrorMessage(language, error));
      return;
    }
    setIsFollowing((prev) => !prev);
    setFollowersCount((prev) => (isFollowing ? Math.max(0, prev - 1) : prev + 1));
  };

  const handleMessage = async () => {
    if (!viewerId) {
      Alert.alert("Auth Required", "Please sign in first.");
      return;
    }
    if (viewerId === ownerId) return;

    setDmLoading(true);
    const [one, two] = viewerId < ownerId ? [viewerId, ownerId] : [ownerId, viewerId];
    const existing = await runRequestWithPolicy(() =>
      supabase
        .from("dm_threads")
        .select("id")
        .eq("participant1_id", one)
        .eq("participant2_id", two)
        .maybeSingle()
    );

    if (existing.error) {
      setDmLoading(false);
      Alert.alert("DM Error", getRequestErrorMessage(language, existing.error, "Could not open DM thread."));
      return;
    }

    let threadId = existing.data?.id ?? null;
    if (!threadId) {
      const created = await runRequestWithPolicy(() =>
        supabase
          .from("dm_threads")
          .insert({
            participant1_id: one,
            participant2_id: two,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single()
      );
      if (created.error || !created.data) {
        setDmLoading(false);
        Alert.alert("DM Error", getRequestErrorMessage(language, created.error, "Could not start DM thread."));
        return;
      }
      threadId = created.data.id;
    }
    setDmLoading(false);

    navigation.getParent()?.navigate("Feed", {
      screen: "DMThread",
      params: { threadId, otherHandle: profile?.handle ?? handle },
    });
  };

  const handleShareProfile = async () => {
    const safeHandle = profile?.handle ?? handle;
    const url = `https://eoynx.com/u/${safeHandle}`;
    try {
      await Share.share({
        message: url,
        url,
        title: profile?.display_name ?? `@${safeHandle}`,
      });
    } catch {
      // Ignore cancellation.
    }
  };

  const openItem = (item: Item) => {
    navigation.getParent()?.navigate("Feed", {
      screen: "FeedItemDetail",
      params: { item },
    });
  };

  const rankPercent = useMemo(() => {
    if (items.length === 0) return 90;
    const estimated = 100 - Math.min(80, Math.round(items.length * 2.5));
    return Math.max(5, estimated);
  }, [items.length]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarFallback}>
                    {(profile?.display_name ?? profile?.handle ?? "U").charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.headerMain}>
                <Text style={styles.displayName}>{profile?.display_name ?? profile?.handle ?? handle}</Text>
                <Text style={styles.handleText}>@{profile?.handle ?? handle}</Text>
                {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                <View style={styles.followRow}>
                  <Text style={styles.followStat}>
                    <Text style={styles.followCount}>{followersCount.toLocaleString()}</Text> Followers
                  </Text>
                  <Text style={styles.followStat}>
                    <Text style={styles.followCount}>{followingCount.toLocaleString()}</Text> Following
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  {isOwner ? (
                    <Pressable onPress={() => navigation.getParent()?.navigate("Profile")} style={styles.secondaryAction}>
                      <Text style={styles.secondaryActionLabel}>My Profile</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable disabled={followLoading} onPress={handleFollowToggle} style={styles.primaryAction}>
                        <Text style={styles.primaryActionLabel}>
                          {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                        </Text>
                      </Pressable>
                      <Pressable disabled={dmLoading} onPress={handleMessage} style={styles.secondaryAction}>
                        <Text style={styles.secondaryActionLabel}>{dmLoading ? "..." : "Message"}</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable onPress={handleShareProfile} style={styles.secondaryAction}>
                    <Text style={styles.secondaryActionLabel}>Share</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={styles.rankCard}>
              <Text style={styles.rankValue}>Top {rankPercent}%</Text>
              <Text style={styles.rankMeta}>Vault • Global</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[styles.categoryChip, selectedCategory === cat.id ? styles.categoryChipActive : null]}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat.id ? styles.categoryChipTextActive : null]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.controlsRow}>
            <Text style={styles.itemCount}>{filteredItems.length} items</Text>
          </View>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No public items.</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => openItem(item)} style={styles.itemCard}>
          <View style={styles.itemImageWrap}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.itemImage} />
            ) : (
              <View style={styles.itemImageFallback}>
                <Text style={styles.itemImageFallbackText}>No Image</Text>
              </View>
            )}
          </View>
          <View style={styles.itemBody}>
            <Text style={styles.itemLikes}>♥ {(item.like_count ?? 0).toLocaleString()}</Text>
            {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
            <Text numberOfLines={1} style={styles.itemTitle}>
              {item.title}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  listContent: {
    alignSelf: "center",
    maxWidth: webUi.layout.pageMaxWidth,
    paddingBottom: 20,
    width: "100%",
  },
  headerCard: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    gap: 12,
  },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  avatarImage: {
    borderRadius: 30,
    height: 60,
    width: 60,
  },
  avatarFallback: {
    color: webUi.color.text,
    fontSize: 22,
    fontWeight: "700",
  },
  headerMain: {
    flex: 1,
  },
  displayName: {
    color: webUi.color.text,
    fontSize: webUi.typography.pageTitle,
    fontWeight: "700",
  },
  handleText: {
    color: webUi.color.textMuted,
    fontSize: webUi.typography.pageSubtitle,
    marginTop: 2,
  },
  bio: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  followRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 10,
  },
  followStat: {
    color: webUi.color.textSecondary,
    fontSize: 11,
  },
  followCount: {
    color: webUi.color.text,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  primaryActionLabel: {
    color: webUi.color.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  secondaryActionLabel: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  rankCard: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: webUi.radius.xl,
    marginTop: 12,
    padding: 12,
  },
  rankValue: {
    color: webUi.color.text,
    fontSize: 24,
    fontWeight: "800",
  },
  rankMeta: {
    color: webUi.color.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 8,
  },
  categoryChip: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  categoryChipText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: webUi.color.primaryText,
  },
  controlsRow: {
    marginBottom: 10,
  },
  itemCount: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  gridRow: {
    gap: 10,
    justifyContent: "space-between",
  },
  itemCard: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
    width: "48.5%",
  },
  itemImageWrap: {
    aspectRatio: 1,
    backgroundColor: webUi.color.surfaceMuted,
  },
  itemImage: {
    height: "100%",
    width: "100%",
  },
  itemImageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  itemImageFallbackText: {
    color: webUi.color.textMuted,
    fontSize: 11,
  },
  itemBody: {
    padding: 10,
  },
  itemLikes: {
    color: webUi.color.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemBrand: {
    color: webUi.color.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  itemTitle: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  empty: {
    color: webUi.color.textMuted,
    paddingVertical: 30,
    textAlign: "center",
  },
});
