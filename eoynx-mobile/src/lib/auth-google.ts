import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();
const OAUTH_REDIRECT_URL = "eoynxmobile://auth/callback";

export async function signInWithGoogleMobile(): Promise<void> {
  const envRedirect = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL?.trim();
  const fallbackRedirect = Linking.createURL("auth/callback");
  const redirectTo =
    envRedirect && envRedirect.length > 0 ? envRedirect : OAUTH_REDIRECT_URL;

  // Debug info for OAuth redirect mismatch troubleshooting
  console.log("[OAuth] envRedirectTo =", envRedirect ?? "<empty>");
  console.log("[OAuth] fallbackRedirectTo =", fallbackRedirect);
  console.log("[OAuth] redirectTo =", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error("Google OAuth URL was not returned.");
  }

  console.log("[OAuth] authUrl =", data.url);
  // In Expo Go, openAuthSessionAsync can fail to return reliably.
  // We open browser and process callback URL in a global Linking listener.
  const result = await WebBrowser.openBrowserAsync(data.url);
  console.log("[OAuth] browserResultType =", result.type);
}
