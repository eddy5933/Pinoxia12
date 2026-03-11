import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import {
  UserPlus,
  Search,
  Check,
  X,
  MessageCircle,
  UserMinus,
  Users,
  Clock,
  Store,
  Bell,
  Send,
  Star,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useChat } from "@/providers/ChatProvider";
import { Friend, FriendRequest } from "@/types";
import { PublicUser } from "@/providers/FriendsProvider";

type TabType = "friends" | "requests" | "search";

interface ToastState {
  visible: boolean;
  message: string;
  userName: string;
  type: "success" | "error" | "info";
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const {
    friends,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    cancelFriendRequest,
    toggleCloseFriend,
    getPendingRequests,
    getSentRequests,
    isFriend,
    hasPendingRequest,
    registerUser,
    refetchUsers,
    isRefetching,
  } = useFriends();
  const { getOrCreateConversation } = useChat();

  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [searchQuery, setSearchQuery] = useState("");
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

  const pendingRequests = useMemo(
    () => (user ? getPendingRequests(user.id) : []),
    [user, getPendingRequests]
  );

  const sentRequests = useMemo(
    () => (user ? getSentRequests(user.id) : []),
    [user, getSentRequests]
  );

  const allAvailableUsers = useMemo(
    () => (user ? searchUsers("", user.id) : []),
    [user, searchUsers]
  );

  const searchResults = useMemo(
    () => (user ? searchUsers(searchQuery, user.id) : []),
    [user, searchQuery, searchUsers]
  );

  const handleSendRequest = useCallback(
    async (toUser: PublicUser) => {
      if (!user) return;
      const success = await sendFriendRequest(user, toUser);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Friend request sent!", toUser.name, "success");
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Already connected", toUser.name, "info");
      }
    },
    [user, sendFriendRequest, showToast]
  );

  const handleAccept = useCallback(
    async (requestId: string) => {
      if (!user) return;
      const req = pendingRequests.find((r) => r.id === requestId);
      await acceptFriendRequest(requestId, user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Friend added!", req?.fromUserName ?? "User", "success");
    },
    [user, acceptFriendRequest, pendingRequests, showToast]
  );

  const handleReject = useCallback(
    async (requestId: string) => {
      await rejectFriendRequest(requestId);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [rejectFriendRequest]
  );

  const handleCancelRequest = useCallback(
    (requestId: string, userName: string) => {
      Alert.alert("Cancel Request", `Cancel friend request to ${userName}?`, [
        { text: "No", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            await cancelFriendRequest(requestId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showToast("Request cancelled", userName, "info");
          },
        },
      ]);
    },
    [cancelFriendRequest, showToast]
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

  const handleRemoveFriend = useCallback(
    (friend: Friend) => {
      Alert.alert("Remove Friend", `Remove ${friend.name} from friends?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFriend(friend.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [removeFriend]
  );

  const handleStartChat = useCallback(
    async (friend: Friend) => {
      if (!user) return;
      const convo = await getOrCreateConversation(user.id, user.name, friend.userId, friend.name);
      router.push(`/chat/${convo.id}` as any);
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
            onPress={() => handleRemoveFriend(item)}
            activeOpacity={0.7}
          >
            <UserMinus size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleStartChat, handleRemoveFriend, handleToggleCloseFriend]
  );

  const renderRequestItem = useCallback(
    ({ item }: { item: FriendRequest }) => (
      <View style={styles.requestCard}>
        <View style={styles.friendAvatar}>
          <Text style={styles.friendAvatarText}>
            {item.fromUserName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.fromUserName}</Text>
          <Text style={styles.friendEmail}>{item.fromUserEmail}</Text>
          <Text style={styles.requestTime}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => void handleAccept(item.id)}
            activeOpacity={0.7}
          >
            <Check size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => void handleReject(item.id)}
            activeOpacity={0.7}
          >
            <X size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleAccept, handleReject]
  );

  const renderSearchItem = useCallback(
    ({ item }: { item: PublicUser }) => {
      const alreadyFriend = isFriend(item.id);
      const pendingReq = user ? hasPendingRequest(user.id, item.id) : false;
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
          {alreadyFriend ? (
            <View style={styles.statusBadge}>
              <Check size={14} color={Colors.success} />
              <Text style={styles.statusText}>Friends</Text>
            </View>
          ) : pendingReq ? (
            <View style={styles.statusBadge}>
              <Clock size={14} color={Colors.warning} />
              <Text style={[styles.statusText, { color: Colors.warning }]}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => void handleSendRequest(item)}
              activeOpacity={0.7}
            >
              <UserPlus size={16} color={Colors.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isFriend, hasPendingRequest, user, handleSendRequest]
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Users size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to connect</Text>
          <Text style={styles.emptySubtitle}>Add friends and chat to plan your meetups</Text>
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
        <Text style={styles.headerTitle}>Friends</Text>
        {pendingRequests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingRequests.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        {(["friends", "requests", "search"] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "friends" ? `Friends (${friends.length})` : tab === "requests" ? `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}` : "Find People"}
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

      {activeTab === "friends" && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <Users size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptySubtitle}>Search for people to add as friends</Text>
            </View>
          }
        />
      )}

      {activeTab === "requests" && (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            sentRequests.length > 0 ? (
              <View style={styles.sentSection}>
                <Text style={styles.sentTitle}>Sent Requests ({sentRequests.length})</Text>
                {sentRequests.map((req) => (
                  <View key={req.id} style={styles.sentCard}>
                    <View style={[styles.friendAvatar, styles.sentAvatar]}>
                      <Text style={styles.friendAvatarText}>{req.toUserName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{req.toUserName}</Text>
                      <Text style={styles.friendEmail}>Pending...</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleCancelRequest(req.id, req.toUserName)}
                      activeOpacity={0.7}
                    >
                      <X size={14} color={Colors.error} />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {pendingRequests.length > 0 && (
                  <Text style={styles.sentTitle}>Incoming Requests</Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            sentRequests.length === 0 ? (
              <View style={styles.emptyCenter}>
                <Clock size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No requests</Text>
                <Text style={styles.emptySubtitle}>Friend requests will appear here</Text>
              </View>
            ) : null
          }
        />
      )}

      {activeTab === "search" && (
        <FlatList
          data={searchQuery.trim().length > 0 ? searchResults : allAvailableUsers}
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
            <View style={styles.emptyCenter}>
              <Search size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>No users or owners available yet</Text>
            </View>
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
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
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
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
  },
  requestTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
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
  sentSection: {
    marginBottom: 16,
  },
  sentTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  sentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
  },
  sentAvatar: {
    backgroundColor: Colors.surfaceLight,
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  cancelButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(230,57,70,0.12)",
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.25)",
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.error,
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
