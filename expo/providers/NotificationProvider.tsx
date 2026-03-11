import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserPlus, MessageCircle, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import createContextHook from "@nkzw/create-context-hook";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useChat } from "@/providers/ChatProvider";
import Colors from "@/constants/colors";

interface InAppNotification {
  id: string;
  type: "friend_request" | "message";
  title: string;
  body: string;
  timestamp: number;
}

const NOTIFICATION_DURATION = 4000;

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const { user } = useAuth();
  const { requests } = useFriends();
  const { messages, conversations } = useChat();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevRequestCountRef = useRef<number | null>(null);
  const prevMessageCountRef = useRef<number | null>(null);
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    prevRequestCountRef.current = null;
    prevMessageCountRef.current = null;
    seenRequestIdsRef.current = new Set();
    seenMessageIdsRef.current = new Set();
    console.log("[Notification] Reset seen refs for user:", user?.id ?? "none");
  }, [user?.id]);

  const hideNotification = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  }, [slideAnim, opacityAnim]);

  const showNotification = useCallback(
    (notif: InAppNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
      setVisible(true);

      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        hideNotification();
      }, NOTIFICATION_DURATION);
    },
    [slideAnim, opacityAnim, hideNotification]
  );

  useEffect(() => {
    if (!user) return;

    const pendingForMe = requests.filter(
      (r) => r.toUserId === user.id && r.status === "pending"
    );

    if (prevRequestCountRef.current === null) {
      prevRequestCountRef.current = pendingForMe.length;
      pendingForMe.forEach((r) => seenRequestIdsRef.current.add(r.id));
      return;
    }

    const newRequests = pendingForMe.filter(
      (r) => !seenRequestIdsRef.current.has(r.id)
    );

    if (newRequests.length > 0) {
      const latest = newRequests[0];
      seenRequestIdsRef.current.add(latest.id);

      showNotification({
        id: `notif_fr_${latest.id}`,
        type: "friend_request",
        title: "Friend Request",
        body: `${latest.fromUserName} sent you a friend request`,
        timestamp: Date.now(),
      });
      console.log("[Notification] Friend request from", latest.fromUserName);
    }

    prevRequestCountRef.current = pendingForMe.length;
    pendingForMe.forEach((r) => seenRequestIdsRef.current.add(r.id));
  }, [requests, user, showNotification]);

  useEffect(() => {
    if (!user) return;

    const myMessages = messages.filter((m) => m.senderId !== user.id);

    if (prevMessageCountRef.current === null) {
      prevMessageCountRef.current = myMessages.length;
      myMessages.forEach((m) => seenMessageIdsRef.current.add(m.id));
      return;
    }

    const newMessages = myMessages.filter(
      (m) => !seenMessageIdsRef.current.has(m.id)
    );

    if (newMessages.length > 0) {
      const latest = newMessages[newMessages.length - 1];
      seenMessageIdsRef.current.add(latest.id);

      const convo = conversations.find((c) => c.id === latest.conversationId);
      const senderName =
        convo?.participantNames?.[latest.senderId] || latest.senderName;

      const bodyText =
        latest.type === "location"
          ? `${senderName} shared their location`
          : latest.text.length > 60
          ? `${latest.text.slice(0, 60)}...`
          : latest.text;

      showNotification({
        id: `notif_msg_${latest.id}`,
        type: "message",
        title: senderName,
        body: bodyText,
        timestamp: Date.now(),
      });
      console.log("[Notification] New message from", senderName);
    }

    prevMessageCountRef.current = myMessages.length;
    myMessages.forEach((m) => seenMessageIdsRef.current.add(m.id));
  }, [messages, user, conversations, showNotification]);

  const currentNotification = notifications[0] ?? null;

  const ToastComponent = useMemo(() => {
    if (!currentNotification) return null;

    const isFriendRequest = currentNotification.type === "friend_request";
    const accentColor = isFriendRequest ? "#3B82F6" : Colors.success;

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.toastContainer,
          {
            top: insets.top + 8,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={hideNotification}
          style={[styles.toast, { borderLeftColor: accentColor }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accentColor + "20" }]}>
            {isFriendRequest ? (
              <UserPlus size={18} color={accentColor} />
            ) : (
              <MessageCircle size={18} color={accentColor} />
            )}
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.toastTitle} numberOfLines={1}>
              {currentNotification.title}
            </Text>
            <Text style={styles.toastBody} numberOfLines={2}>
              {currentNotification.body}
            </Text>
          </View>
          <TouchableOpacity
            onPress={hideNotification}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
          >
            <X size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [currentNotification, insets.top, slideAnim, opacityAnim, hideNotification]);

  return useMemo(() => ({
    notifications,
    ToastComponent,
    visible,
  }), [notifications, ToastComponent, visible]);
});

export function NotificationToast() {
  const { ToastComponent } = useNotifications();
  return ToastComponent ? (
    <View style={styles.overlay} pointerEvents="box-none">
      {ToastComponent}
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    position: "absolute" as const,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#1E1E1E",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  toastBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
  },
});
