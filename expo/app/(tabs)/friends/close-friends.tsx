import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  ChevronLeft,
  MessageCircle,
  UserMinus,
  MapPin,
  Users,
  Sparkles,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useChat } from "@/providers/ChatProvider";
import { Friend } from "@/types";

interface ToastState {
  visible: boolean;
  message: string;
  type: "success" | "info";
}

export default function CloseFriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { closeFriends, toggleCloseFriend, unfollowUser } = useFriends();
  const { getOrCreateConversation } = useChat();

  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    setToast({ visible: true, message, type });
    toastAnim.setValue(-100);
    toastOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setToast((prev) => ({ ...prev, visible: false })));
    }, 2500);
  }, [toastAnim, toastOpacity]);

  const handleRemoveCloseFriend = useCallback(
    async (friend: Friend) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleCloseFriend(friend.id);
      showToast(`${friend.name} removed from close friends`, "info");
    },
    [toggleCloseFriend, showToast]
  );

  const handleStartChat = useCallback(
    async (friend: Friend) => {
      if (!user) return;
      const convo = await getOrCreateConversation(user.id, user.name, friend.userId, friend.name);
      router.push(`/chat/${convo.id}` as any);
    },
    [user, getOrCreateConversation, router]
  );

  const handleUnfollow = useCallback(
    (friend: Friend) => {
      Alert.alert("Unfollow", `Unfollow ${friend.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: async () => {
            await unfollowUser(friend.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [unfollowUser]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Friend; index: number }) => (
      <View style={[styles.card, index === 0 && styles.cardFirst]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.starBadge}>
            <Star size={10} color="#FFB800" fill="#FFB800" />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => void handleStartChat(item)}
            activeOpacity={0.7}
            testID={`close-friend-chat-${item.userId}`}
          >
            <MessageCircle size={16} color="#1E88E5" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => void handleRemoveCloseFriend(item)}
            activeOpacity={0.7}
            testID={`close-friend-remove-star-${item.userId}`}
          >
            <Star size={16} color="#FFB800" fill="#FFB800" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => handleUnfollow(item)}
            activeOpacity={0.7}
            testID={`close-friend-remove-${item.userId}`}
          >
            <UserMinus size={14} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleStartChat, handleRemoveCloseFriend, handleUnfollow]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          testID="close-friends-back"
        >
          <ChevronLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Star size={18} color="#FFB800" fill="#FFB800" />
          <Text style={styles.headerTitle}>Close Friends</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{closeFriends.length}</Text>
        </View>
      </View>

      <View style={styles.descriptionBar}>
        <MapPin size={14} color={Colors.textMuted} />
        <Text style={styles.descriptionText}>
          Close friends can see your live location on the map
        </Text>
      </View>

      <FlatList
        data={closeFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Sparkles size={32} color="#FFB800" />
            </View>
            <Text style={styles.emptyTitle}>No close friends yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the star icon on any friend to add them to your close friends list
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Users size={16} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Go to Friends</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {toast.visible && (
        <Animated.View
          style={[
            styles.toastWrap,
            { paddingTop: insets.top + 8 },
            { transform: [{ translateY: toastAnim }], opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.toast, toast.type === "info" && styles.toastInfo]}>
            <Star size={14} color="#FFB800" fill={toast.type === "success" ? "#FFB800" : "transparent"} />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,184,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.3)",
  },
  countText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#FFB800",
  },
  descriptionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descriptionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.18)",
  },
  cardFirst: {
    marginTop: 0,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#B8860B",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 19,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  starBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,184,0,0.4)",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  email: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnDanger: {
    backgroundColor: "rgba(230,57,70,0.1)",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,184,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.2)",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  toastWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: SCREEN_WIDTH - 40,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#1B3A2A",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastInfo: {
    backgroundColor: "#1B2A3A",
    borderColor: "rgba(30,136,229,0.3)",
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});
