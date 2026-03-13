import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { supabase } from "../lib/supabase";
import { useThemePreference } from "../theme/ThemeContext";
import { webUi } from "../theme/webUi";

type BlockedUser = {
  id: string;
  handle: string;
  display_name: string | null;
  blocked_at: string;
};

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { language, setLanguage, t } = useI18n();
  const { themePreference, setThemePreference } = useThemePreference();
  const [loading, setLoading] = useState(true);
  const [savingDmOpen, setSavingDmOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dmOpen, setDmOpen] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);

    const { data: profileRes, error: profileErr } = await supabase
      .from("profiles")
      .select("dm_open")
      .eq("id", uid)
      .maybeSingle();

    if (!profileErr) {
      setDmOpen(profileRes?.dm_open ?? true);
    }

    const { data: blocksRes, error: blocksErr } = await supabase
      .from("blocks")
      .select("blocked_id,created_at")
      .eq("blocker_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);

    if (blocksErr) {
      setLoading(false);
      Alert.alert("Load Error", blocksErr.message);
      return;
    }

    const blockedIds = (blocksRes ?? []).map((row) => row.blocked_id as string);
    if (blockedIds.length === 0) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }

    const { data: profilesRes, error: profilesErr } = await supabase
      .from("profiles")
      .select("id,handle,display_name")
      .in("id", blockedIds);

    if (profilesErr) {
      setLoading(false);
      Alert.alert("Load Error", profilesErr.message);
      return;
    }

    const profileMap = new Map(
      (profilesRes ?? []).map((p) => [p.id as string, { handle: p.handle as string, display_name: p.display_name as string | null }])
    );
    setBlockedUsers(
      (blocksRes ?? []).map((row) => ({
        id: row.blocked_id as string,
        handle: profileMap.get(row.blocked_id as string)?.handle ?? "unknown",
        display_name: profileMap.get(row.blocked_id as string)?.display_name ?? null,
        blocked_at: row.created_at as string,
      }))
    );
    setLoading(false);
  };

  const toggleDmOpen = async (next: boolean) => {
    if (!userId) return;
    setDmOpen(next);
    setSavingDmOpen(true);
    const { error } = await supabase.from("profiles").update({ dm_open: next }).eq("id", userId);
    setSavingDmOpen(false);
    if (error) {
      setDmOpen(!next);
      Alert.alert("Update Error", error.message);
    }
  };

  const unblockUser = async (blockedId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
    if (error) {
      Alert.alert("Unblock Error", error.message);
      return;
    }
    setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
  };

  const handleSignOut = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(t("settings.signOutTitle"), t("settings.signOutConfirm"), [
        { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
        { text: t("settings.signOut"), style: "destructive", onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Sign Out Error", error.message);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.account")}</Text>
        <Pressable onPress={() => navigation.navigate("Profile", { screen: "ProfileEdit" })} style={styles.rowButton}>
          <Text style={styles.rowLabel}>{t("settings.editProfile")}</Text>
          <Text style={styles.rowAction}>{t("settings.open")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Feed", { screen: "NotificationsHome" })} style={styles.rowButton}>
          <Text style={styles.rowLabel}>{t("settings.notifications")}</Text>
          <Text style={styles.rowAction}>{t("settings.open")}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.privacy")}</Text>
        <View style={styles.rowButton}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{t("settings.allowDm")}</Text>
            <Text style={styles.rowHint}>{t("settings.allowDmHint")}</Text>
          </View>
          <Switch
            onValueChange={(next) => void toggleDmOpen(next)}
            value={dmOpen}
            disabled={savingDmOpen || loading}
            trackColor={{ false: webUi.color.switchTrackOff, true: webUi.color.switchTrackOn }}
            thumbColor={dmOpen ? webUi.color.primary : webUi.color.surface}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
        <Text style={styles.rowHint}>{t("settings.languageHint")}</Text>
        <View style={styles.languageRow}>
          <Pressable
            onPress={() => void setLanguage("ko")}
            style={[styles.languageChip, language === "ko" ? styles.languageChipActive : null]}
          >
            <Text style={[styles.languageChipLabel, language === "ko" ? styles.languageChipLabelActive : null]}>
              {t("settings.korean")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void setLanguage("en")}
            style={[styles.languageChip, language === "en" ? styles.languageChipActive : null]}
          >
            <Text style={[styles.languageChipLabel, language === "en" ? styles.languageChipLabelActive : null]}>
              {t("settings.english")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.theme")}</Text>
        <Text style={styles.rowHint}>{t("settings.themeHint")}</Text>
        <View style={styles.languageRow}>
          <Pressable
            onPress={() => void setThemePreference("system")}
            style={[styles.languageChip, themePreference === "system" ? styles.languageChipActive : null]}
          >
            <Text style={[styles.languageChipLabel, themePreference === "system" ? styles.languageChipLabelActive : null]}>
              {t("settings.themeSystem")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void setThemePreference("light")}
            style={[styles.languageChip, themePreference === "light" ? styles.languageChipActive : null]}
          >
            <Text style={[styles.languageChipLabel, themePreference === "light" ? styles.languageChipLabelActive : null]}>
              {t("settings.themeLight")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void setThemePreference("dark")}
            style={[styles.languageChip, themePreference === "dark" ? styles.languageChipActive : null]}
          >
            <Text style={[styles.languageChipLabel, themePreference === "dark" ? styles.languageChipLabelActive : null]}>
              {t("settings.themeDark")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.blockedUsers")}</Text>
        {loading ? <ActivityIndicator style={styles.loader} /> : null}
        {!loading && blockedUsers.length === 0 ? <Text style={styles.empty}>{t("settings.noBlockedUsers")}</Text> : null}
        {blockedUsers.map((user) => (
          <View key={user.id} style={styles.blockedRow}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>{user.display_name ?? `@${user.handle}`}</Text>
              <Text style={styles.rowHint}>@{user.handle}</Text>
            </View>
            <Pressable onPress={() => void unblockUser(user.id)} style={styles.unblockButton}>
              <Text style={styles.unblockLabel}>{t("settings.unblock")}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable onPress={handleSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutLabel}>{t("settings.signOut")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: webUi.color.bg,
  },
  container: {
    alignSelf: "center",
    flexGrow: 1,
    gap: 12,
    maxWidth: webUi.layout.pageMaxWidth,
    paddingBottom: 24,
    width: "100%",
  },
  title: {
    color: webUi.color.text,
    fontSize: 26,
    fontWeight: "700",
  },
  sectionTitle: {
    color: webUi.color.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  rowButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "600",
  },
  rowHint: {
    color: webUi.color.textMuted,
    fontSize: 11,
  },
  rowAction: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  languageChip: {
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageChipActive: {
    backgroundColor: webUi.color.primary,
    borderColor: webUi.color.primary,
  },
  languageChipLabel: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  languageChipLabelActive: {
    color: webUi.color.primaryText,
  },
  loader: {
    marginVertical: 8,
  },
  empty: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  blockedRow: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unblockButton: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unblockLabel: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: webUi.color.danger,
    borderRadius: webUi.radius.xl,
    marginTop: 8,
    paddingVertical: 12,
  },
  signOutLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
});
