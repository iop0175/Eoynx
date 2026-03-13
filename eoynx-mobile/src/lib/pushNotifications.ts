import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getProjectId = () => {
  const fromConstants = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  return fromConstants ?? fromEas ?? null;
};

export async function registerPushTokenForUser(userId: string): Promise<void> {
  if (!Device.isDevice) {
    console.log("[Push] skipped: emulator/simulator");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7C3AED",
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;
  if (finalStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }
  if (finalStatus !== "granted") {
    console.log("[Push] permission not granted");
    return;
  }

  const projectId = getProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const token = tokenResult.data;
  if (!token) {
    console.log("[Push] empty token");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ expo_push_token: token })
    .eq("id", userId);
  if (error) {
    console.log("[Push] token save failed", error.message);
    return;
  }
  console.log("[Push] token saved");
}
