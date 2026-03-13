import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { ProfileStackParamList } from "../navigation/types";
import { webUi } from "../theme/webUi";
import type { Item } from "../types/item";
import type { Profile } from "../types/profile";

type ProfileScreenProps = {
  session: Session;
} & NativeStackScreenProps<ProfileStackParamList, "ProfileOverview">;

type SortKey = "latest" | "oldest";

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

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "latest", label: "Latest" },
  { id: "oldest", label: "Oldest" },
];

export function ProfileScreen({ session, navigation }: ProfileScreenProps) {
  const user = session.user;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("latest");

  const loadProfile = useCallback(async () => {
    setLoading(true);

    const [profileRes, itemsRes, followersRes, followingRes] = await Promise.all([
      supabase.from("profiles").select("id,handle,display_name,bio,avatar_url,dm_open").eq("id", user.id).maybeSingle(),
      supabase
        .from("items")
        .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at")
        .eq("owner_id", user.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60)
        .returns<ItemRow[]>(),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);

    setLoading(false);

    // Backward compatibility for projects without dm_open.
    if (profileRes.error && profileRes.error.message.includes("dm_open")) {
      const fallback = await supabase
        .from("profiles")
        .select("id,handle,display_name,bio,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (fallback.error) {
        Alert.alert("Profile Error", fallback.error.message);
        return;
      }

      setProfile(
        fallback.data
          ? {
              ...fallback.data,
              dm_open: true,
            }
          : null
      );
    } else if (profileRes.error) {
      Alert.alert("Profile Error", profileRes.error.message);
      return;
    } else {
      setProfile(profileRes.data);
    }

    if (itemsRes.error) {
      Alert.alert("Load Error", itemsRes.error.message);
      return;
    }

    const rows = itemsRes.data ?? [];
    const itemIds = rows.map((row) => row.id);
    let likeCountByItem = new Map<string, number>();

    if (itemIds.length > 0) {
      const likesRes = await supabase.from("likes").select("item_id").in("item_id", itemIds);
      if (!likesRes.error) {
        likeCountByItem = new Map();
        for (const like of likesRes.data ?? []) {
          likeCountByItem.set(like.item_id, (likeCountByItem.get(like.item_id) ?? 0) + 1);
        }
      }
    }

    const ownerHandle = (profileRes.data?.handle ?? profile?.handle ?? user.email?.split("@")[0] ?? "me").toLowerCase();
    const ownerName = profileRes.data?.display_name ?? profile?.display_name ?? null;
    const ownerAvatar = profileRes.data?.avatar_url ?? profile?.avatar_url ?? null;

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
          handle: ownerHandle,
          display_name: ownerName,
          avatar_url: ownerAvatar,
        },
        like_count: likeCountByItem.get(row.id) ?? 0,
      }))
    );

    if (!followersRes.error) setFollowersCount(followersRes.count ?? 0);
    if (!followingRes.error) setFollowingCount(followingRes.count ?? 0);
  }, [user.id, user.email, profile?.avatar_url, profile?.display_name, profile?.handle]);

  useEffect(() => {
    void loadProfile();
    const unsubscribe = navigation.addListener("focus", () => {
      void loadProfile();
    });
    return unsubscribe;
  }, [loadProfile, navigation]);

  const filteredItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "latest" ? bTime - aTime : aTime - bTime;
    });
    return sorted;
  }, [items, sortBy]);

  const rankPercent = useMemo(() => {
    if (items.length === 0) return 90;
    const estimated = 100 - Math.min(80, Math.round(items.length * 2.5));
    return Math.max(5, estimated);
  }, [items.length]);

  const onShareProfile = async () => {
    const handle = profile?.handle ?? "me";
    try {
      await Share.share({
        message: `https://eoynx.com/u/${handle}`,
        url: `https://eoynx.com/u/${handle}`,
        title: profile?.display_name ?? `@${handle}`,
      });
    } catch {
      // Ignore share cancellation.
    }
  };

  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerTopRow}>
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarFallback}>
              {(profile?.display_name ?? profile?.handle ?? "M").charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.headerMain}>
          <View style={styles.nameRow}>
            <View>
              <Text style={styles.displayName}>{profile?.display_name ?? profile?.handle ?? "Me"}</Text>
              <Text style={styles.handleText}>@{profile?.handle ?? "me"}</Text>
            </View>
          </View>

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
            <Pressable onPress={() => navigation.navigate("ProfileEdit")} style={styles.primaryAction}>
              <Text style={styles.primaryActionLabel}>Edit Profile</Text>
            </Pressable>
            <Pressable onPress={onShareProfile} style={styles.secondaryAction}>
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
  );

  const renderControls = () => (
    <View style={styles.controlsRow}>
      <Text style={styles.itemCount}>{filteredItems.length} items</Text>
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => {
          const active = sortBy === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setSortBy(opt.id)}
              style={[styles.sortChip, active ? styles.sortChipActive : null]}
            >
              <Text style={[styles.sortChipLabel, active ? styles.sortChipLabelActive : null]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderItemCard = ({ item }: { item: Item }) => (
    <Pressable
      onPress={() => navigation.navigate("FeedItemDetail", { item })}
      style={styles.itemCard}
    >
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
        <View style={styles.itemMetaRow}>
          <Text style={styles.itemLikes}>♥ {(item.like_count ?? 0).toLocaleString()}</Text>
        </View>
        {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
        <Text numberOfLines={1} style={styles.itemTitle}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      ListEmptyComponent={<Text style={styles.empty}>No items yet.</Text>}
      ListFooterComponent={<View style={styles.bottomSpace} />}
      ListHeaderComponent={
        <>
          {renderHeader()}
          {renderControls()}
        </>
      }
      columnWrapperStyle={styles.gridRow}
      data={filteredItems}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={renderItemCard}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: "center",
    maxWidth: webUi.layout.pageMaxWidth,
    width: "100%",
  },
  listContent: {
    paddingBottom: 4,
  },
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  displayName: {
    color: webUi.color.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  handleText: {
    color: webUi.color.textMuted,
    fontSize: 12,
    marginTop: 2,
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
  bio: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: "row",
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
    letterSpacing: -0.6,
  },
  rankMeta: {
    color: webUi.color.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemCount: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  sortRow: {
    flexDirection: "row",
    gap: 6,
  },
  sortChip: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortChipActive: {
    backgroundColor: webUi.color.surfaceMuted,
  },
  sortChipLabel: {
    color: webUi.color.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  sortChipLabelActive: {
    color: webUi.color.text,
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
  itemMetaRow: {
    marginBottom: 4,
  },
  itemLikes: {
    color: webUi.color.textMuted,
    fontSize: 10,
    fontWeight: "600",
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
    paddingVertical: 40,
    textAlign: "center",
  },
  bottomSpace: {
    height: 18,
  },
});
