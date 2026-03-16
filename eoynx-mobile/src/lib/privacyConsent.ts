import type { User } from "@supabase/supabase-js";

export const PRIVACY_CONSENT_VERSION = "2026-03-13";

export function hasPrivacyConsent(user: User | null | undefined): boolean {
  return Boolean(user?.user_metadata?.privacy_consent);
}

export function isLikelyNewGoogleUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
  const hasGoogleProvider = providers.includes("google") || user.app_metadata?.provider === "google";
  if (!hasGoogleProvider) return false;

  const createdAt = Date.parse(user.created_at ?? "");
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
  if (!Number.isFinite(createdAt) || !Number.isFinite(lastSignInAt)) return false;

  return Math.abs(lastSignInAt - createdAt) <= 2 * 60 * 1000;
}
