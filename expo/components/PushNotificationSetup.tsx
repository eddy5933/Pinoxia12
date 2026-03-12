import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
} from "@/lib/pushNotifications";

export default function PushNotificationSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const registeredUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      if (registeredUserRef.current) {
        console.log("[Push] User logged out, removing token");
        void removePushToken(registeredUserRef.current);
        registeredUserRef.current = null;
      }
      return;
    }

    if (registeredUserRef.current === user.id) return;

    const setup = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(user.id, token);
        registeredUserRef.current = user.id;
        console.log("[Push] Registered for user:", user.id);
      }
    };

    void setup();
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("[Push] Notification received:", notification.request.content.title);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("[Push] Notification tapped, data:", JSON.stringify(data));

        if (data?.type === "message" && typeof data?.conversationId === "string") {
          router.push(`/chat/${data.conversationId}`);
        }
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  return null;
}
