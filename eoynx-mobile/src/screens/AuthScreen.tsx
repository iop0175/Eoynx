import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import { signInWithGoogleMobile } from "../lib/auth-google";
import { supabase } from "../lib/supabase";
import { webUi } from "../theme/webUi";

type AuthMode = "signIn" | "signUp";

export function AuthScreen() {
  const { t } = useI18n();
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Validation", t("auth.validation"));
      return;
    }

    setAuthLoading(true);

    const result =
      authMode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setAuthLoading(false);

    if (result.error) {
      Alert.alert("Auth Error", result.error.message);
      return;
    }

    if (authMode === "signUp" && !result.data.session) {
      Alert.alert("Success", t("auth.success"));
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogleMobile();
    } catch (error) {
      Alert.alert("Google Sign-In Error", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>{t("auth.signInTitle")}</Text>
      <Text style={styles.pageSubtitle}>{t("auth.subtitle")}</Text>

      <View style={styles.authContainer}>
        <Pressable disabled={googleLoading} onPress={handleGoogleSignIn} style={styles.googleButton}>
          <Text style={styles.googleButtonLabel}>
            {googleLoading ? t("auth.connecting") : t("auth.continueGoogle")}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, authMode === "signIn" && styles.modeButtonActive]}
            onPress={() => setAuthMode("signIn")}
          >
            <Text style={[styles.modeLabel, authMode === "signIn" && styles.modeLabelActive]}>{t("auth.signIn")}</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, authMode === "signUp" && styles.modeButtonActive]}
            onPress={() => setAuthMode("signUp")}
          >
            <Text style={[styles.modeLabel, authMode === "signUp" && styles.modeLabelActive]}>{t("auth.signUp")}</Text>
          </Pressable>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={webUi.color.placeholder}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable disabled={authLoading} onPress={handleAuth} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {authLoading ? t("auth.loading") : authMode === "signIn" ? t("auth.signIn") : t("auth.createAccount")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignSelf: "center",
    gap: 8,
    maxWidth: webUi.layout.pageMaxWidth,
    marginTop: 14,
    width: "100%",
  },
  pageTitle: {
    color: webUi.color.text,
    fontSize: 26,
    fontWeight: "700",
  },
  pageSubtitle: {
    color: webUi.color.textMuted,
    marginBottom: 6,
  },
  authContainer: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
    padding: 16,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  modeButtonActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  modeLabel: {
    color: webUi.color.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  modeLabelActive: {
    color: webUi.color.primaryText,
  },
  input: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: webUi.color.text,
    borderRadius: webUi.radius.xl,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingVertical: 12,
  },
  googleButtonLabel: {
    color: webUi.color.text,
    fontWeight: "700",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  dividerLine: {
    backgroundColor: webUi.color.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
});
