import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") {
    console.log("[Push] Web platform, skipping push registration");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      console.log("[Push] Requesting permissions...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission not granted:", finalStatus);
      return null;
    }

    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.warn("[Push] Missing EXPO_PUBLIC_PROJECT_ID");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("[Push] Token obtained:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.warn("[Push] Registration error:", error);
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);

    if (error) {
      console.warn("[Push] Save token error:", error.message);
    } else {
      console.log("[Push] Token saved for user:", userId);
    }
  } catch (e) {
    console.warn("[Push] Save token exception:", e);
  }
}

export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ push_token: null })
      .eq("id", userId);

    if (error) {
      console.warn("[Push] Remove token error:", error.message);
    } else {
      console.log("[Push] Token removed for user:", userId);
    }
  } catch (e) {
    console.warn("[Push] Remove token exception:", e);
  }
}

export async function sendPushToUser(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", targetUserId)
      .maybeSingle();

    if (error || !profile?.push_token) {
      console.log("[Push] No push token for user:", targetUserId);
      return;
    }

    const pushToken = profile.push_token as string;
    console.log("[Push] Sending notification to:", targetUserId, "token:", pushToken);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default",
        priority: "high",
        data: data ?? {},
      }),
    });

    const result = await response.json();
    console.log("[Push] Send result:", JSON.stringify(result));
  } catch (e) {
    console.warn("[Push] Send error:", e);
  }
}

if (Platform.OS === "android") {
  void Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E63946",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}
