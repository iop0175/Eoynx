import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../i18n";
import { PRIVACY_CONSENT_VERSION } from "../../lib/privacyConsent";
import { webUi } from "../../theme/webUi";

type PrivacyConsentGateScreenProps = {
  onCompleted: () => void;
};

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_CONSENT_URL?.trim() || "https://eoynx.com/privacy-consent";

export function PrivacyConsentGateScreen({ onCompleted }: PrivacyConsentGateScreenProps) {
  const { setLanguage, t } = useI18n();
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getSystemLanguage = (): "ko" | "en" => {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? "en";
    return locale.startsWith("ko") ? "ko" : "en";
  };

  const openConsentDoc = async () => {
    const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL);
    if (!canOpen) {
      Alert.alert("Open Error", t("auth.privacyOpenError"));
      return;
    }
    await Linking.openURL(PRIVACY_POLICY_URL);
  };

  const handleSubmit = async () => {
    if (!consentChecked) {
      Alert.alert("Validation", t("auth.privacyRequired"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        privacy_consent: true,
        privacy_consent_version: PRIVACY_CONSENT_VERSION,
        privacy_consent_at: new Date().toISOString(),
      },
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Consent Error", error.message);
      return;
    }
    await setLanguage(getSystemLanguage());
    onCompleted();
  };

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>{t("auth.privacyTitle")}</Text>
      <Text style={styles.pageSubtitle}>{t("auth.privacySubtitle")}</Text>

      <View style={styles.card}>
        <Pressable onPress={() => setConsentChecked((prev) => !prev)} style={styles.checkboxRow}>
          <View style={[styles.checkbox, consentChecked ? styles.checkboxActive : null]}>
            {consentChecked ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxText}>{t("auth.privacyLabel")}</Text>
        </Pressable>

        <Pressable onPress={openConsentDoc} style={styles.docButton}>
          <Text style={styles.docButtonLabel}>{t("auth.privacyView")}</Text>
        </Pressable>

        <Pressable disabled={submitting} onPress={handleSubmit} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {submitting ? t("auth.loading") : t("auth.privacyContinue")}
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
    marginTop: 14,
    maxWidth: webUi.layout.pageMaxWidth,
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
  },
  card: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 12,
    marginTop: 18,
    padding: 16,
  },
  checkboxRow: {
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
  checkboxText: {
    color: webUi.color.textSecondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  docButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingVertical: 11,
  },
  docButtonLabel: {
    color: webUi.color.text,
    fontWeight: "700",
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
});
