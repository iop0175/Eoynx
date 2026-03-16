import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import type { FeedStackParamList } from "../../navigation/types";
import { webUi } from "../../theme/webUi";

type Props = NativeStackScreenProps<FeedStackParamList, "DMRequests">;

type RequestRow = {
  id: string;
  from_user_id: string;
  thread_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
};

type RequestItem = {
  id: string;
  fromUserId: string;
  fromHandle: string;
  fromName: string | null;
  threadId: string;
};

export function DMRequestsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  useEffect(() => {
    void loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
      return;
    }
    const userId = authData.user.id;

    const { data, error } = await supabase
      .from("dm_requests")
      .select("id,from_user_id,thread_id,status,created_at")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setLoading(false);
      Alert.alert("Load Error", error.message);
      return;
    }

    const rows = (data ?? []) as RequestRow[];
    const fromIds = Array.from(new Set(rows.map((row) => row.from_user_id)));
    const { data: profiles, error: profilesError } = fromIds.length
      ? await supabase.from("profiles").select("id,handle,display_name").in("id", fromIds)
      : { data: [], error: null };

    setLoading(false);

    if (profilesError) {
      Alert.alert("Load Error", profilesError.message);
      return;
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));
    setRequests(
      rows.map((row) => ({
        id: row.id,
        fromUserId: row.from_user_id,
        fromHandle: profileMap.get(row.from_user_id)?.handle ?? "unknown",
        fromName: profileMap.get(row.from_user_id)?.display_name ?? null,
        threadId: row.thread_id,
      }))
    );
  };

  const respond = async (requestId: string, accept: boolean, threadId: string, otherHandle: string) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from("dm_requests")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", requestId)
      .eq("to_user_id", userId);
    if (error) {
      Alert.alert("Update Error", error.message);
      return;
    }

    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (accept) {
      navigation.navigate("DMThread", { threadId, otherHandle });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DM Requests</Text>
      {loading ? <ActivityIndicator style={styles.loader} /> : null}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>@{item.fromHandle}</Text>
            <Text style={styles.cardMeta}>{item.fromName ?? "-"}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={() => void respond(item.id, false, item.threadId, item.fromHandle)} style={styles.declineButton}>
                <Text style={styles.declineLabel}>Decline</Text>
              </Pressable>
              <Pressable onPress={() => void respond(item.id, true, item.threadId, item.fromHandle)} style={styles.acceptButton}>
                <Text style={styles.acceptLabel}>Accept</Text>
              </Pressable>
            </View>
          </View>
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
  title: { color: webUi.color.text, fontSize: webUi.typography.pageTitle, fontWeight: "700" },
  loader: { marginTop: 8 },
  card: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
    padding: 12,
  },
  cardTitle: { color: webUi.color.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: webUi.color.textMuted, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  declineButton: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: webUi.layout.controlVerticalPadding - 2,
  },
  declineLabel: { color: webUi.color.textSecondary, fontSize: 12, fontWeight: "700" },
  acceptButton: {
    backgroundColor: webUi.color.text,
    borderRadius: webUi.radius.xl,
    paddingHorizontal: 10,
    paddingVertical: webUi.layout.controlVerticalPadding - 2,
  },
  acceptLabel: { color: webUi.color.primaryText, fontSize: 12, fontWeight: "700" },
  empty: { color: webUi.color.textMuted, textAlign: "center", marginTop: 24 },
});
