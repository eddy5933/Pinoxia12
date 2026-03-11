import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  UserPlus,
  Search,
  Check,
  MessageCircle,
  UserMinus,
  Users,
  Store,
  Bell,
  Send,
  Star,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter as useExpoRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useChat } from "@/providers/ChatProvider";
import { Friend } from "@/types";
import { PublicUser } from "@/providers/FriendsProvider";

type TabType = "following" | "search";

interface ToastState {
  visible: boolean;
  message: string;
  userName: string;
  type: "success" | "error" | "info";
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const expoRouter = useExpoRouter();
  const { user } = useAuth();
  const {
    friends,
    searchUsersFromSupabase,
    followUser,
    unfollowUser,
    toggleCloseFriend,
    isFollowing,
    registerUser,
    refetchUsers,
    isRefetching,
  } = useFriends();
  const { getOrCreateConversation } = useChat();

  const [activeTab, setActiveTab] = useState<TabType>("following");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveSearchResults, setLiveSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", userName: "", type: "success" });
  const toastAnim = useRef(new Animated.Value(-120)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, userName: string, type: "success" | "error" | "info" = "success") => {
    setToast({ visible: true, message, userName, type });
    toastAnim.setValue(-120);
    toastOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(toastAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToast((prev) => ({ ...prev, visible: false })));
    }, 3000);
  }, [toastAnim, toastOpacity]);

  useEffect(() => {
    if (user) {
      void registerUser(user);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "search") return;

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        console.log("[FriendsSearch] Searching Supabase for:", searchQuery);
        const results = await searchUsersFromSupabase(searchQuery, user.id);
        setLiveSearchResults(results);
        console.log("[FriendsSearch] Got", results.length, "results");
      } catch (err) {
        console.warn("[FriendsSearch] Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, user, activeTab, searchUsersFromSupabase]);

  useEffect(() => {
    if (activeTab === "search" && user) {
      setIsSearching(true);
      searchUsersFromSupabase("", user.id).then((results) => {
        setLiveSearchResults(results);
        setIsSearching(false);
      }).catch(() => setIsSearching(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFollow = useCallback(
    async (toUser: PublicUser) => {
      if (!user) return;
      const success = await followUser(user, toUser);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Now following!", toUser.name, "success");
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Already following", toUser.name, "info");
      }
    },
    [user, followUser, showToast]
  );

  const handleToggleCloseFriend = useCallback(
    async (friend: Friend) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleCloseFriend(friend.id);
      const wasClose = friend.isCloseFriend;
      showToast(
        wasClose ? "Removed from close friends" : "Added to close friends",
        friend.name,
        wasClose ? "info" : "success"
      );
    },
    [toggleCloseFriend, showToast]
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
            showToast("Unfollowed", friend.name, "info");
          },
        },
      ]);
    },
    [unfollowUser, showToast]
  );

  const handleStartChat = useCallback(
    async (friend: Friend) => {
      if (!user) return;
      try {
        const convo = await getOrCreateConversation(user.id, user.name, friend.userId, friend.name);
        console.log("[Friends] Navigating to chat:", convo.id);
        router.push(`/chat/${convo.id}` as any);
      } catch (err) {
        console.warn("[Friends] Failed to start chat:", err);
      }
    },
    [user, getOrCreateConversation, router]
  );

  const renderFriendItem = useCallback(
    ({ item }: { item: Friend }) => (
      <View style={[styles.friendCard, item.isCloseFriend && styles.friendCardClose]}>
        <TouchableOpacity
          style={[styles.friendAvatar, item.isCloseFriend && styles.friendAvatarClose]}
          onPress={() => void handleToggleCloseFriend(item)}
          activeOpacity={0.7}
          testID={`close-friend-toggle-${item.userId}`}
        >
          <Text style={styles.friendAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
          {item.isCloseFriend && (
            <View style={styles.closeBadge}>
              <Star size={10} color="#FFB800" fill="#FFB800" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.friendInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.friendName}>{item.name}</Text>
            {item.isCloseFriend && (
              <View style={styles.closeTag}>
                <Star size={9} color="#FFB800" fill="#FFB800" />
                <Text style={styles.closeTagText}>Close</Text>
              </View>
            )}
          </View>
          <Text style={styles.friendEmail}>{item.email}</Text>
        </View>
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={[
              styles.starButton,
              item.isCloseFriend && styles.starButtonActive,
            ]}
            onPress={() => void handleToggleCloseFriend(item)}
            activeOpacity={0.7}
          >
            <Star
              size={16}
              color={item.isCloseFriend ? "#FFB800" : Colors.textMuted}
              fill={item.isCloseFriend ? "#FFB800" : "transparent"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => void handleStartChat(item)}
            activeOpacity={0.7}
          >
            <MessageCircle size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleUnfollow(item)}
            activeOpacity={0.7}
          >
            <UserMinus size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleStartChat, handleUnfollow, handleToggleCloseFriend]
  );

  const renderSearchItem = useCallback(
    ({ item }: { item: PublicUser }) => {
      const alreadyFollowing = isFollowing(item.id);
      const isOwnerUser = item.role === "owner";

      return (
        <View style={styles.friendCard}>
          <View style={[styles.friendAvatar, styles.searchAvatar]}>
            <Text style={styles.friendAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.friendName}>{item.name}</Text>
              {isOwnerUser && (
                <View style={styles.ownerBadge}>
                  <Store size={10} color={Colors.star} />
                  <Text style={styles.ownerBadgeText}>Business</Text>
                </View>
              )}
            </View>
            <Text style={styles.friendEmail}>{item.email}</Text>
          </View>
          {alreadyFollowing ? (
            <View style={styles.statusBadge}>
              <Check size={14} color={Colors.success} />
              <Text style={styles.statusText}>Following</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => void handleFollow(item)}
              activeOpacity={0.7}
            >
              <UserPlus size={16} color={Colors.white} />
              <Text style={styles.addButtonText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isFollowing, handleFollow]
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>People</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Users size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to connect</Text>
          <Text style={styles.emptySubtitle}>Follow people and chat to plan your meetups</Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>People</Text>
      </View>

      <View style={styles.closeFriendsRow}>
        <TouchableOpacity
          style={styles.closeFriendsBtn}
          onPress={() => expoRouter.push("/(tabs)/friends/close-friends" as any)}
          activeOpacity={0.7}
          testID="close-friends-list-btn"
        >
          <Star size={15} color="#FFB800" fill="#FFB800" />
          <Text style={styles.closeFriendsBtnText}>Close Friends</Text>
          <View style={styles.closeFriendsCount}>
            <Text style={styles.closeFriendsCountText}>
              {friends.filter((f) => f.isCloseFriend).length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(["following", "search"] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "following" ? `Following (${friends.length})` : "Find People"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "search" && (
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            testID="search-users-input"
          />
        </View>
      )}

      {activeTab === "following" && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchUsers}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <Users size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Not following anyone</Text>
              <Text style={styles.emptySubtitle}>Search for people to follow</Text>
            </View>
          }
        />
      )}

      {activeTab === "search" && (
        <FlatList
          data={liveSearchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchUsers}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            isSearching ? (
              <View style={styles.emptyCenter}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.emptyTitle}>Searching...</Text>
              </View>
            ) : (
              <View style={styles.emptyCenter}>
                <Search size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySubtitle}>Try searching by name or email</Text>
              </View>
            )
          }
        />
      )}
      {toast.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            { paddingTop: insets.top + 8 },
            {
              transform: [{ translateY: toastAnim }],
              opacity: toastOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[
            styles.toastInner,
            toast.type === "success" && styles.toastSuccess,
            toast.type === "error" && styles.toastError,
            toast.type === "info" && styles.toastInfo,
          ]}>
            <View style={[
              styles.toastIconWrap,
              toast.type === "success" && styles.toastIconSuccess,
              toast.type === "error" && styles.toastIconError,
              toast.type === "info" && styles.toastIconInfo,
            ]}>
              {toast.type === "success" ? (
                <Send size={16} color="#fff" />
              ) : toast.type === "error" ? (
                <X size={16} color="#fff" />
              ) : (
                <Bell size={16} color="#fff" />
              )}
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={styles.toastTitle}>{toast.message}</Text>
              <Text style={styles.toastSubtitle}>{toast.userName}</Text>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  searchAvatar: {
    backgroundColor: Colors.surfaceHighlight,
  },
  friendAvatarText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  friendEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  friendActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  starButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  starButtonActive: {
    backgroundColor: "rgba(255,184,0,0.15)",
  },
  friendCardClose: {
    borderColor: "rgba(255,184,0,0.25)",
  },
  friendAvatarClose: {
    backgroundColor: "#B8860B",
  },
  closeBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.4)",
  },
  closeTag: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,184,0,0.12)",
  },
  closeTagText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#FFB800",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  nameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  ownerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,184,0,0.12)",
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.star,
  },
  closeFriendsRow: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  closeFriendsBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,184,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.2)",
    alignSelf: "flex-start" as const,
  },
  closeFriendsBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#FFB800",
  },
  closeFriendsCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,184,0,0.15)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 6,
  },
  closeFriendsCountText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFB800",
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  signInBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 24,
  },
  signInBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  toastContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    width: SCREEN_WIDTH - 32,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: "#1B3A2A",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.3)",
  },
  toastError: {
    backgroundColor: "#3A1B1B",
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.3)",
  },
  toastInfo: {
    backgroundColor: "#1B2A3A",
    borderWidth: 1,
    borderColor: "rgba(30,136,229,0.3)",
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  toastIconSuccess: {
    backgroundColor: Colors.success,
  },
  toastIconError: {
    backgroundColor: Colors.error,
  },
  toastIconInfo: {
    backgroundColor: "#1E88E5",
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  toastSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
