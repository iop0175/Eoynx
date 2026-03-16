import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import type { Item } from "../types/item";
import { webUi } from "../theme/webUi";
import type { SearchStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SearchStackParamList, "SearchHome">;

type Person = {
  id: string;
  handle: string;
  display_name: string | null;
};

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  brand: string | null;
  owner_id: string;
  visibility: "public" | "unlisted" | "private";
  created_at: string;
  profiles:
    | { handle: string; display_name: string | null; avatar_url: string | null }
    | Array<{ handle: string; display_name: string | null; avatar_url: string | null }>
    | null;
};

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"people" | "items">("people");

  const hasQuery = useMemo(() => query.trim().length > 0, [query]);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    const [peopleRes, itemsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,handle,display_name")
        .or(`handle.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
        .limit(20),
      supabase
        .from("items")
        .select("id,title,description,image_url,category,brand,owner_id,visibility,created_at,profiles(handle,display_name,avatar_url)")
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,brand.ilike.%${trimmed}%`)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setLoading(false);

    if (peopleRes.error || itemsRes.error) {
      Alert.alert("Search Error", peopleRes.error?.message ?? itemsRes.error?.message ?? "Unknown error");
      return;
    }

    setPeople((peopleRes.data ?? []) as Person[]);
    setItems(
      ((itemsRes.data ?? []) as ItemRow[]).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          image_url: row.image_url,
          category: row.category,
          brand: row.brand,
          owner_id: row.owner_id,
          visibility: row.visibility,
          created_at: row.created_at,
          owner: {
            handle: profile?.handle ?? "unknown",
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          },
        };
      })
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setQuery}
          onSubmitEditing={() => void runSearch()}
          placeholder="Search people or items"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={query}
        />
        <Pressable disabled={!hasQuery || loading} onPress={() => void runSearch()} style={styles.searchButton}>
          <Text style={styles.searchButtonLabel}>{loading ? "..." : "Go"}</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab("people")} style={[styles.tabButton, tab === "people" && styles.tabButtonActive]}>
          <Text style={[styles.tabLabel, tab === "people" && styles.tabLabelActive]}>People</Text>
        </Pressable>
        <Pressable onPress={() => setTab("items")} style={[styles.tabButton, tab === "items" && styles.tabButtonActive]}>
          <Text style={[styles.tabLabel, tab === "items" && styles.tabLabelActive]}>Items</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      {tab === "people" ? (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No people found.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("SearchUserProfile", {
                  ownerId: item.id,
                  handle: item.handle,
                })
              }
              style={styles.card}
            >
              <Text style={styles.cardTitle}>@{item.handle}</Text>
              <Text style={styles.cardMeta}>{item.display_name ?? "-"}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No items found.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => Alert.alert("Item", "Open this item from Feed tab for full detail view.")}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                @{item.owner.handle} · {item.category ?? "Uncategorized"}
              </Text>
            </Pressable>
          )}
        />
      )}
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
  title: {
    color: webUi.color.text,
    fontSize: webUi.typography.pageTitle,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: webUi.layout.controlVerticalPadding,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: webUi.radius.xl,
    justifyContent: "center",
    minWidth: 56,
  },
  searchButtonLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: webUi.color.primary,
    borderColor: webUi.color.primary,
  },
  tabLabel: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: webUi.color.primaryText,
  },
  loader: {
    marginTop: 6,
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 4,
    marginBottom: 8,
    padding: 12,
  },
  cardTitle: {
    color: webUi.color.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cardMeta: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  empty: {
    color: webUi.color.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
});
