import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { webUi } from "../../theme/webUi";
import type { Profile } from "../../types/profile";

export function ProfileEditScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [dmOpen, setDmOpen] = useState(true);

  useEffect(() => {
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,handle,display_name,bio,avatar_url,dm_open")
      .eq("id", uid)
      .maybeSingle<Profile>();

    if (error && error.message.includes("dm_open")) {
      const fallback = await supabase
        .from("profiles")
        .select("id,handle,display_name,bio,avatar_url")
        .eq("id", uid)
        .maybeSingle();

      setLoading(false);

      if (fallback.error) {
        Alert.alert("Profile Error", fallback.error.message);
        return;
      }

      if (!fallback.data) return;
      setHandle(fallback.data.handle ?? "");
      setDisplayName(fallback.data.display_name ?? "");
      setBio(fallback.data.bio ?? "");
      setDmOpen(true);
      return;
    }

    setLoading(false);

    if (error) {
      Alert.alert("Profile Error", error.message);
      return;
    }

    if (!data) return;
    setHandle(data.handle ?? "");
    setDisplayName(data.display_name ?? "");
    setBio(data.bio ?? "");
    setDmOpen(data.dm_open ?? true);
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert("Error", "User session missing.");
      return;
    }
    if (!handle.trim()) {
      Alert.alert("Validation", "Handle is required.");
      return;
    }

    setSaving(true);

    let saveError: { message: string } | null = null;

    const saveWithDm = await supabase
      .from("profiles")
      .update({
        bio: bio.trim() || null,
        display_name: displayName.trim() || null,
        dm_open: dmOpen,
        handle: handle.trim().toLowerCase(),
      })
      .eq("id", userId);

    if (saveWithDm.error && saveWithDm.error.message.includes("dm_open")) {
      const saveFallback = await supabase
        .from("profiles")
        .update({
          bio: bio.trim() || null,
          display_name: displayName.trim() || null,
          handle: handle.trim().toLowerCase(),
        })
        .eq("id", userId);
      saveError = saveFallback.error;
    } else {
      saveError = saveWithDm.error;
    }

    setSaving(false);

    if (saveError) {
      Alert.alert("Save Error", saveError.message);
      return;
    }

    Alert.alert("Saved", "Profile updated.");
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>
      {loading ? <ActivityIndicator /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Handle</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setHandle}
          placeholder="handle"
          style={styles.input}
          value={handle}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          autoCorrect={false}
          onChangeText={setDisplayName}
          placeholder="display name"
          style={styles.input}
          value={displayName}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          multiline
          onChangeText={setBio}
          placeholder="bio"
          style={[styles.input, styles.textArea]}
          value={bio}
        />
      </View>

      <View style={[styles.card, styles.row]}>
        <Text style={styles.label}>DM Open</Text>
        <Switch onValueChange={setDmOpen} value={dmOpen} />
      </View>

      <Pressable disabled={saving} onPress={handleSave} style={styles.saveButton}>
        <Text style={styles.saveButtonLabel}>{saving ? "Saving..." : "Save Profile"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: webUi.layout.pageGap,
    maxWidth: webUi.layout.pageMaxWidth,
    paddingTop: 4,
    width: "100%",
  },
  title: {
    color: webUi.color.text,
    fontSize: webUi.typography.pageTitle,
    fontWeight: "700",
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    paddingHorizontal: 14,
    paddingVertical: webUi.layout.controlVerticalPadding + 1,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: webUi.radius.xl,
    marginTop: 4,
    paddingVertical: webUi.layout.controlVerticalPadding + 2,
  },
  saveButtonLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
});
