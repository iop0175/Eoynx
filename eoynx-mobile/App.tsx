import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Appearance, DevSettings, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createNavigationContainerRef } from "@react-navigation/native";
import { I18nProvider } from "./src/i18n";
import type { Item } from "./src/types/item";
import { registerPushTokenForUser } from "./src/lib/pushNotifications";
import { supabase } from "./src/lib/supabase";
import { ThemeProvider, type ThemePreference } from "./src/theme/ThemeContext";
import { applyWebUiTheme, type AppTheme, webUi } from "./src/theme/webUi";
import type { RootStackParamList } from "./src/navigation/types";

const THEME_STORAGE_KEY = "eoynx.theme";
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [themeReady, setThemeReady] = useState(false);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<AppTheme>("light");
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

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
      return Appearance.getColorScheme() === "dark" ? "dark" : "light";
    };

    const initTheme = async () => {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      const pref: ThemePreference =
        stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      const nextResolved = resolveTheme(pref);
      applyWebUiTheme(nextResolved);
      if (!active) return;
      setThemePreferenceState(pref);
      setResolvedTheme(nextResolved);
      setThemeReady(true);
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
      next === "system" ? (Appearance.getColorScheme() === "dark" ? "dark" : "light") : next;
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
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Session initialization timeout.")), 8000)
        );
        const result = await Promise.race([supabase.auth.getSession(), timeout]);
        if (result.error) {
          Alert.alert("Session Error", result.error.message);
        }
        if (mounted) {
          setSession(result.data.session);
        }
      } catch (error) {
        if (mounted) {
          Alert.alert("Session Error", error instanceof Error ? error.message : "Unknown session error.");
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
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          Alert.alert("Google Sign-In Error", error.message);
        }
        return;
      }

      if (!code) {
        console.log("[OAuth] callback has no code or tokens");
        return;
      }

      console.log("[OAuth] code callback detected");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        Alert.alert("Google Sign-In Error", error.message);
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
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void routeFromPushData(response.notification.request.content.data as Record<string, unknown>);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      void routeFromPushData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => {
      sub.remove();
    };
  }, [session]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    void registerPushTokenForUser(uid);
  }, [session?.user?.id]);

  if (initializing || !themeReady) {
    return (
      <View style={[styles.center, { backgroundColor: webUi.color.bg }]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, { color: webUi.color.textMuted }]}>Initializing app...</Text>
      </View>
    );
  }

  const { RootNavigator } = require("./src/navigation/RootNavigator");

  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ themePreference, resolvedTheme, setThemePreference }}>
        <I18nProvider>
          <View style={[styles.screen, { backgroundColor: webUi.color.bg }]}>
            <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
            <RootNavigator navigationRef={navigationRef} session={session} />
            <View pointerEvents="none" style={styles.debugBadge}>
              <Text style={styles.debugText}>{session ? "session:on" : "session:off"}</Text>
            </View>
          </View>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
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
  debugBadge: {
    bottom: 12,
    left: 12,
    position: "absolute",
  },
  debugText: {
    backgroundColor: "rgba(15,23,42,0.75)",
    borderRadius: 6,
    color: "#FFFFFF",
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
