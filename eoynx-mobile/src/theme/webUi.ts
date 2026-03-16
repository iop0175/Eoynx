export type AppTheme = "light" | "dark";

const lightColor = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#FAFAFA",
  border: "#E5E5E5",
  text: "#171717",
  textSecondary: "#525252",
  textMuted: "#737373",
  placeholder: "#A3A3A3",
  primary: "#7C3AED",
  primaryText: "#FFFFFF",
  danger: "#DC2626",
  successBg: "#DCFCE7",
  successText: "#166534",
  noticeBg: "#FFF7ED",
  noticeBorder: "#FDBA74",
  switchTrackOff: "#D4D4D4",
  switchTrackOn: "#A78BFA",
  overlayStrong: "rgba(0,0,0,0.95)",
  overlayMedium: "rgba(0,0,0,0.45)",
  overlaySoft: "rgba(0,0,0,0.35)",
  overlayControl: "rgba(0,0,0,0.6)",
  overlayDot: "rgba(255,255,255,0.55)",
  surfaceOverlay: "rgba(255,255,255,0.9)",
};

const darkColor = {
  bg: "#0A0A0A",
  surface: "#121212",
  surfaceMuted: "#1A1A1A",
  border: "#2A2A2A",
  text: "#F5F5F5",
  textSecondary: "#D4D4D4",
  textMuted: "#A3A3A3",
  placeholder: "#737373",
  primary: "#8B5CF6",
  primaryText: "#FFFFFF",
  danger: "#EF4444",
  successBg: "#14532D",
  successText: "#BBF7D0",
  noticeBg: "#3F1D0D",
  noticeBorder: "#9A3412",
  switchTrackOff: "#3F3F46",
  switchTrackOn: "#7C3AED",
  overlayStrong: "rgba(0,0,0,0.95)",
  overlayMedium: "rgba(0,0,0,0.5)",
  overlaySoft: "rgba(0,0,0,0.4)",
  overlayControl: "rgba(0,0,0,0.7)",
  overlayDot: "rgba(255,255,255,0.35)",
  surfaceOverlay: "rgba(24,24,27,0.9)",
};

export const webUi = {
  layout: {
    pageMaxWidth: 920,
    pageGap: 12,
    controlVerticalPadding: 10,
  },
  typography: {
    pageTitle: 24,
    pageSubtitle: 12,
    cardTitle: 14,
    body: 13,
    caption: 12,
  },
  color: {
    ...lightColor,
  },
  radius: {
    md: 10,
    xl: 12,
    xxl: 16,
  },
};

export function applyWebUiTheme(theme: AppTheme) {
  const next = theme === "dark" ? darkColor : lightColor;
  Object.assign(webUi.color, next);
}
