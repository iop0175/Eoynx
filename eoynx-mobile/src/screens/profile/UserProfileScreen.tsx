import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { webUi } from "../../theme/webUi";

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
};

type UserItem = {
  id: string;
  title: string;
  category: string | null;
  brand: string | null;
};

export function UserProfileScreen({ route }: Props) {
  const { ownerId, handle } = route.params;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<UserItem[]>([]);

  useEffect(() => {
    void loadData();
  }, [ownerId]);

  const loadData = async () => {
    setLoading(true);
    const [profileRes, itemsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,handle,display_name,bio")
        .eq("id", ownerId)
        .maybeSingle<PublicProfile>(),
      supabase
        .from("items")
        .select("id,title,category,brand")
        .eq("owner_id", ownerId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setLoading(false);

    let resolvedItems = (itemsRes.data ?? []) as UserItem[];
    let resolvedItemsError = itemsRes.error;

    // Backward compatibility for projects missing category/brand columns.
    if (itemsRes.error && (itemsRes.error.message.includes("category") || itemsRes.error.message.includes("brand"))) {
      const fallbackItems = await supabase
        .from("items")
        .select("id,title")
        .eq("owner_id", ownerId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(30);

      resolvedItemsError = fallbackItems.error;
      resolvedItems = (fallbackItems.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        category: null,
        brand: null,
      }));
    }

    if (profileRes.error || resolvedItemsError) {
      Alert.alert("Load Error", profileRes.error?.message ?? resolvedItemsError?.message ?? "Unknown error");
      return;
    }

    setProfile(profileRes.data);
    setItems(resolvedItems);
  };

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator /> : null}

      <View style={styles.card}>
        <Text style={styles.handle}>@{profile?.handle ?? handle}</Text>
        <Text style={styles.displayName}>{profile?.display_name ?? "-"}</Text>
        <Text style={styles.bio}>{profile?.bio ?? "No bio yet."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Public Items</Text>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No public items.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.itemRow}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {item.category ?? "Uncategorized"}
                {item.brand ? ` | ${item.brand}` : ""}
              </Text>
            </Pressable>
          )}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: 12,
    maxWidth: webUi.layout.pageMaxWidth,
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
  handle: {
    color: webUi.color.text,
    fontSize: 18,
    fontWeight: "700",
  },
  displayName: {
    color: webUi.color.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  bio: {
    color: webUi.color.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    color: webUi.color.text,
    fontSize: 15,
    fontWeight: "700",
  },
  itemRow: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    gap: 4,
    marginTop: 8,
    padding: 10,
  },
  itemTitle: {
    color: webUi.color.text,
    fontSize: 14,
    fontWeight: "700",
  },
  itemMeta: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  empty: {
    color: webUi.color.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
