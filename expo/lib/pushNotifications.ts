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
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission not granted");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    let token: string | null = null;

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId ?? undefined,
      });
      token = tokenData.data;
      console.log("[Push] Expo push token:", token);
    } catch (expoTokenError) {
      console.warn("[Push] Failed to get Expo push token, trying device token:", expoTokenError);
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        console.log("[Push] Device push token:", JSON.stringify(deviceToken));
        const retryToken = await Notifications.getExpoPushTokenAsync({
          projectId: projectId ?? undefined,
          devicePushToken: deviceToken,
        });
        token = retryToken.data;
        console.log("[Push] Expo push token (via device token):", token);
      } catch (deviceTokenError) {
        console.warn("[Push] Device token fallback also failed:", deviceTokenError);
      }
    }

    return token;
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

export async function getPushTokenForUser(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    if (error || !data?.push_token) {
      return null;
    }
    return data.push_token as string;
  } catch {
    return null;
  }
}

export async function sendPushToUser(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const token = await getPushTokenForUser(recipientUserId);
    if (!token) {
      console.log("[Push] No push token for user:", recipientUserId);
      return;
    }

    const message = {
      to: token,
      sound: "default" as const,
      title,
      body,
      data: data ?? {},
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("[Push] Sent to", recipientUserId, "result:", JSON.stringify(result));
  } catch (error) {
    console.warn("[Push] Send error:", error);
  }
}

export async function sendPushToMultipleUsers(
  recipientUserIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const promises = recipientUserIds.map((id) => sendPushToUser(id, title, body, data));
  await Promise.allSettled(promises);
}
