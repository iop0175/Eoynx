import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import { webUi } from "../theme/webUi";

export type ReportReason = "spam" | "harassment" | "nsfw" | "scam" | "other";

const REPORT_REASONS: Array<{ key: ReportReason; label: string }> = [
  { key: "spam", label: "Spam" },
  { key: "harassment", label: "Harassment" },
  { key: "nsfw", label: "NSFW" },
  { key: "scam", label: "Scam" },
  { key: "other", label: "Other" },
];

type ReportModalProps = {
  visible: boolean;
  targetName: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description: string) => Promise<{ ok: boolean; error?: string }>;
};

export function ReportModal({ visible, targetName, onClose, onSubmit }: ReportModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => t("report.title", { target: targetName }), [t, targetName]);
  const reasonLabelMap: Record<ReportReason, string> = {
    spam: t("report.reason.spam"),
    harassment: t("report.reason.harassment"),
    nsfw: t("report.reason.nsfw"),
    scam: t("report.reason.scam"),
    other: t("report.reason.other"),
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(reason, description.trim());
      if (!result.ok) {
        setError(result.error ?? t("report.submitFailed"));
        return;
      }
      setSuccess(true);
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setDescription("");
    setReason("spam");
    onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={handleClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {success ? (
            <View style={styles.successWrap}>
              <Text style={styles.successTitle}>{t("report.successTitle")}</Text>
              <Text style={styles.successBody}>{t("report.successBody")}</Text>
              <Pressable onPress={handleClose} style={styles.submitButton}>
                <Text style={styles.submitLabel}>{t("report.done")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{t("report.subtitle")}</Text>

              <View style={styles.reasonWrap}>
                {REPORT_REASONS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setReason(item.key)}
                    style={[styles.reasonChip, reason === item.key && styles.reasonChipActive]}
                  >
                    <Text style={[styles.reasonText, reason === item.key && styles.reasonTextActive]}>
                      {reasonLabelMap[item.key]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                multiline
                onChangeText={setDescription}
                placeholder={t("report.detailsPlaceholder")}
                placeholderTextColor={webUi.color.placeholder}
                style={styles.input}
                textAlignVertical="top"
                value={description}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.buttonRow}>
                <Pressable onPress={handleClose} style={styles.cancelButton}>
                  <Text style={styles.cancelLabel}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable disabled={submitting} onPress={() => void handleSubmit()} style={styles.submitButton}>
                  <Text style={styles.submitLabel}>{submitting ? t("report.submitting") : t("report.submit")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: webUi.color.overlaySoft,
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  container: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    width: "100%",
  },
  title: {
    color: webUi.color.text,
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonChipActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  reasonText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  reasonTextActive: {
    color: webUi.color.primaryText,
  },
  input: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 2,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    minWidth: 90,
    paddingVertical: 10,
  },
  cancelLabel: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: webUi.color.text,
    borderRadius: webUi.radius.xl,
    minWidth: 90,
    paddingVertical: 10,
  },
  submitLabel: {
    color: webUi.color.primaryText,
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: webUi.color.danger,
    fontSize: 12,
  },
  successWrap: {
    gap: 10,
  },
  successTitle: {
    color: webUi.color.text,
    fontSize: 16,
    fontWeight: "700",
  },
  successBody: {
    color: webUi.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
