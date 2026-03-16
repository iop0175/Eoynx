import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import { PRIVACY_CONSENT_VERSION } from "../lib/privacyConsent";
import { signInWithGoogleMobile } from "../lib/auth-google";
import { supabase } from "../lib/supabase";
import { webUi } from "../theme/webUi";

type AuthMode = "signIn" | "signUp";

export function AuthScreen() {
  const { setLanguage, t } = useI18n();
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);

  const privacyDocUrl = process.env.EXPO_PUBLIC_PRIVACY_CONSENT_URL?.trim() || "https://eoynx.com/privacy-consent";

  const getSystemLanguage = (): "ko" | "en" => {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? "en";
    return locale.startsWith("ko") ? "ko" : "en";
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Validation", t("auth.validation"));
      return;
    }
    if (authMode === "signUp" && !privacyConsentChecked) {
      Alert.alert("Validation", t("auth.privacyRequired"));
      return;
    }

    setAuthLoading(true);

    const result =
      authMode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                privacy_consent: true,
                privacy_consent_version: PRIVACY_CONSENT_VERSION,
                privacy_consent_at: new Date().toISOString(),
              },
            },
          });

    setAuthLoading(false);

    if (result.error) {
      Alert.alert("Auth Error", result.error.message);
      return;
    }

    if (authMode === "signUp") {
      await setLanguage(getSystemLanguage());
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

  const openPrivacyDoc = async () => {
    const canOpen = await Linking.canOpenURL(privacyDocUrl);
    if (!canOpen) {
      Alert.alert("Open Error", t("auth.privacyOpenError"));
      return;
    }
    await Linking.openURL(privacyDocUrl);
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
        {authMode === "signUp" ? (
          <View style={styles.privacyWrap}>
            <Pressable onPress={() => setPrivacyConsentChecked((prev) => !prev)} style={styles.privacyRow}>
              <View style={[styles.checkbox, privacyConsentChecked ? styles.checkboxActive : null]}>
                {privacyConsentChecked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.privacyText}>{t("auth.privacyLabel")}</Text>
            </Pressable>
            <Pressable onPress={openPrivacyDoc} style={styles.privacyDocButton}>
              <Text style={styles.privacyDocButtonLabel}>{t("auth.privacyView")}</Text>
            </Pressable>
          </View>
        ) : null}

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
    gap: webUi.layout.pageGap,
    maxWidth: webUi.layout.pageMaxWidth,
    marginTop: 14,
    width: "100%",
  },
  pageTitle: {
    color: webUi.color.text,
    fontSize: webUi.typography.pageTitle,
    fontWeight: "700",
  },
  pageSubtitle: {
    color: webUi.color.textMuted,
    fontSize: webUi.typography.pageSubtitle,
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
  privacyWrap: {
    gap: 8,
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  checkboxActive: {
    backgroundColor: webUi.color.primary,
    borderColor: webUi.color.primary,
  },
  checkmark: {
    color: webUi.color.primaryText,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 12,
  },
  privacyText: {
    color: webUi.color.textSecondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  privacyDocButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingVertical: 9,
  },
  privacyDocButtonLabel: {
    color: webUi.color.text,
    fontSize: 12,
    fontWeight: "700",
  },
});
