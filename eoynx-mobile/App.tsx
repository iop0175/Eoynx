import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Appearance,
  DevSettings,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createNavigationContainerRef } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nProvider } from "./src/i18n";
import type { Item } from "./src/types/item";
import { registerPushTokenForUser } from "./src/lib/pushNotifications";
import {
  exportPublicKeyJwk,
  generateEncryptionKeyPair,
  hasPrivateKey,
  loadPrivateKey,
  savePrivateKey,
} from "./src/lib/encryptionKeys";
import { hasPrivacyConsent, isLikelyNewGoogleUser } from "./src/lib/privacyConsent";
import { getRequestErrorMessage, type ApiErrorLike, runRequestWithPolicy } from "./src/lib/requestPolicy";
import { supabase } from "./src/lib/supabase";
import { LandingVideo } from "./src/components/LandingVideo";
import { PrivacyConsentGateScreen } from "./src/screens/auth/PrivacyConsentGateScreen";
import { ThemeProvider, type ThemePreference } from "./src/theme/ThemeContext";
import { applyWebUiTheme, type AppTheme, webUi } from "./src/theme/webUi";
import type { RootStackParamList } from "./src/navigation/types";

const THEME_STORAGE_KEY = "eoynx.theme";
const LANDING_SEEN_STORAGE_KEY = "eoynx.landing-seen";
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const getSystemTheme = (): AppTheme => (Appearance.getColorScheme() === "dark" ? "dark" : "light");

export default function App() {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<AppTheme>(getSystemTheme);
  const [initializing, setInitializing] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [needsConsentGate, setNeedsConsentGate] = useState(false);

  const getItemForPush = async (itemId: string): Promise<Item | null> => {
    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at,profiles(handle,display_name,avatar_url)")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !data) return null;
    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      image_url: data.image_url,
      image_urls: data.image_urls,
      brand: data.brand,
      category: data.category,
      visibility: data.visibility,
      owner_id: data.owner_id,
      created_at: data.created_at,
      owner: {
        handle: profile?.handle ?? "unknown",
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      liked: false,
      bookmarked: false,
      like_count: 0,
      comment_count: 0,
    };
  };

  const routeFromPushData = async (data: Record<string, unknown> | undefined) => {
    if (!data || !navigationRef.isReady()) return;
    const type = typeof data.type === "string" ? data.type : "";
    const threadId = typeof data.threadId === "string" ? data.threadId : null;
    const itemId = typeof data.itemId === "string" ? data.itemId : null;
    const actorId = typeof data.actorId === "string" ? data.actorId : null;
    const actorHandle = typeof data.actorHandle === "string" ? data.actorHandle : null;

    if (type === "dm" && threadId) {
      navigationRef.navigate("MainTabs", {
        screen: "Feed",
        params: {
          screen: "DMThread",
          params: { threadId, otherHandle: actorHandle ?? "unknown" },
        },
      } as never);
      return;
    }

    if (type === "dm_request") {
      navigationRef.navigate("MainTabs", {
        screen: "Feed",
        params: { screen: "DMRequests" },
      } as never);
      return;
    }

    if ((type === "like" || type === "comment") && itemId) {
      const item = await getItemForPush(itemId);
      if (item) {
        navigationRef.navigate("MainTabs", {
          screen: "Feed",
          params: {
            screen: "FeedItemDetail",
            params: { item },
          },
        } as never);
        return;
      }
      navigationRef.navigate("MainTabs", {
        screen: "Feed",
        params: { screen: "NotificationsHome" },
      } as never);
      return;
    }

    if (type === "follow" && actorId && actorHandle) {
      navigationRef.navigate("MainTabs", {
        screen: "Feed",
        params: {
          screen: "UserProfile",
          params: { ownerId: actorId, handle: actorHandle },
        },
      } as never);
      return;
    }

    navigationRef.navigate("MainTabs", {
      screen: "Feed",
      params: { screen: "NotificationsHome" },
    } as never);
  };

  useEffect(() => {
    let active = true;
    const resolveTheme = (pref: ThemePreference): AppTheme => {
      if (pref === "light") return "light";
      if (pref === "dark") return "dark";
      return getSystemTheme();
    };

    const initTheme = async () => {
      applyWebUiTheme(resolveTheme("system"));
      const [storedTheme, landingSeen] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(LANDING_SEEN_STORAGE_KEY),
      ]);
      const pref: ThemePreference =
        storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
      const nextResolved = resolveTheme(pref);
      applyWebUiTheme(nextResolved);
      if (!active) return;
      setThemePreferenceState(pref);
      setResolvedTheme(nextResolved);
      setShowLanding(landingSeen !== "1");
    };

    void initTheme();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (!active || themePreference !== "system") return;
      const nextResolved: AppTheme = colorScheme === "dark" ? "dark" : "light";
      applyWebUiTheme(nextResolved);
      setResolvedTheme(nextResolved);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [themePreference]);

  const setThemePreference = async (next: ThemePreference) => {
    setThemePreferenceState(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    const nextResolved: AppTheme =
      next === "system" ? getSystemTheme() : next;
    applyWebUiTheme(nextResolved);
    setResolvedTheme(nextResolved);
    if (__DEV__) {
      DevSettings.reload();
      return;
    }
    Alert.alert("Theme Applied", "Please restart the app to apply all screens.");
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const result = await runRequestWithPolicy(() => supabase.auth.getSession(), { timeoutMs: 8000, retries: 1 });
        if (result.error) {
          Alert.alert("Session Error", getRequestErrorMessage("en", result.error, "Could not restore your session."));
        }
        if (mounted) {
          setSession(result.data.session);
        }
      } catch (error) {
        if (mounted) {
          Alert.alert("Session Error", getRequestErrorMessage("en", error as ApiErrorLike, "Could not restore your session."));
        }
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    void loadSession();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log("[Auth] onAuthStateChange event =", event, "session =", !!nextSession);
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleAuthCallback = async (url: string) => {
      if (!url.includes("auth/callback")) return;
      console.log("[OAuth] callbackUrl =", url);

      const callbackUrl = new URL(url);
      const hashParams = new URLSearchParams(
        callbackUrl.hash.startsWith("#") ? callbackUrl.hash.slice(1) : callbackUrl.hash
      );

      const oauthError =
        callbackUrl.searchParams.get("error_description") ||
        callbackUrl.searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");
      if (oauthError) {
        Alert.alert("Google Sign-In Error", oauthError);
        return;
      }

      const code = callbackUrl.searchParams.get("code") || hashParams.get("code");
      const accessToken =
        callbackUrl.searchParams.get("access_token") || hashParams.get("access_token");
      const refreshToken =
        callbackUrl.searchParams.get("refresh_token") || hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        console.log("[OAuth] token callback detected");
        const { error } = await runRequestWithPolicy(
          () =>
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
          { timeoutMs: 10000, retries: 1 }
        );
        if (error) {
          Alert.alert("Google Sign-In Error", getRequestErrorMessage("en", error, "Could not complete sign-in."));
        }
        return;
      }

      if (!code) {
        console.log("[OAuth] callback has no code or tokens");
        return;
      }

      console.log("[OAuth] code callback detected");
      const { data, error } = await runRequestWithPolicy(
        () => supabase.auth.exchangeCodeForSession(code),
        { timeoutMs: 10000, retries: 1 }
      );
      if (error) {
        Alert.alert("Google Sign-In Error", getRequestErrorMessage("en", error, "Could not complete sign-in."));
        return;
      }
      console.log("[OAuth] exchangeCodeForSession success =", !!data.session);
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        void handleAuthCallback(url);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthCallback(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setNeedsConsentGate(false);
      return;
    }
    const shouldGate = !hasPrivacyConsent(session.user) && isLikelyNewGoogleUser(session.user);
    setNeedsConsentGate(shouldGate);
  }, [session?.user]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void routeFromPushData(response.notification.request.content.data as Record<string, unknown>);
    });

    const interaction = InteractionManager.runAfterInteractions(() => {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        void routeFromPushData(response.notification.request.content.data as Record<string, unknown>);
      });
    });

    return () => {
      sub.remove();
      interaction.cancel();
    };
  }, [session]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const interaction = InteractionManager.runAfterInteractions(() => {
      void registerPushTokenForUser(uid);
    });

    return () => {
      interaction.cancel();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    let canceled = false;

    const ensureEncryptionKeys = async () => {
      try {
        const hasKey = await hasPrivateKey(uid);
        if (!hasKey) {
          const keyPair = await generateEncryptionKeyPair();
          await savePrivateKey(uid, keyPair.privateKey);
          const publicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);
          if (!canceled) {
            await supabase.from("profiles").update({ encryption_public_key: publicKeyJwk }).eq("id", uid);
          }
          return;
        }

        const privateKey = await loadPrivateKey(uid);
        if (!privateKey || canceled) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("encryption_public_key")
          .eq("id", uid)
          .maybeSingle();

        if (!profile?.encryption_public_key) {
          const keyPair = await generateEncryptionKeyPair();
          await savePrivateKey(uid, keyPair.privateKey);
          const publicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);
          if (!canceled) {
            await supabase.from("profiles").update({ encryption_public_key: publicKeyJwk }).eq("id", uid);
          }
        }
      } catch (error) {
        console.log("[DM Crypto] mobile key init failed", error);
      }
    };

    void ensureEncryptionKeys();

    return () => {
      canceled = true;
    };
  }, [session?.user?.id]);

  if (showLanding) {
    return (
      <LandingVideo
        theme={resolvedTheme}
        onDone={() => {
          setShowLanding(false);
          void AsyncStorage.setItem(LANDING_SEEN_STORAGE_KEY, "1");
        }}
      />
    );
  }

  if (initializing) {
    return (
      <View style={[styles.center, { backgroundColor: webUi.color.bg }]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, { color: webUi.color.textMuted }]}>Initializing app...</Text>
      </View>
    );
  }

  const { RootNavigator } = require("./src/navigation/RootNavigator");

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaProvider>
        <ThemeProvider value={{ themePreference, resolvedTheme, setThemePreference }}>
          <I18nProvider>
            <View style={[styles.screen, { backgroundColor: webUi.color.bg }]}>
              <StatusBar backgroundColor={webUi.color.surface} style={resolvedTheme === "dark" ? "light" : "dark"} />
              {session && needsConsentGate ? (
                <PrivacyConsentGateScreen onCompleted={() => setNeedsConsentGate(false)} />
              ) : (
                <RootNavigator navigationRef={navigationRef} session={session} />
              )}
            </View>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
  },
});
