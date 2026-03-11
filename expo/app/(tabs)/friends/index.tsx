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
  ActivityIndicator,
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
  Heart,
  UserCheck,
  ChevronRight,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter as useExpoRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useChat } from "@/providers/ChatProvider";
import { Friend, FriendRequest } from "@/types";
import { PublicUser } from "@/providers/FriendsProvider";

type TabType = "friends" | "followers" | "requests" | "discover";

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
    followers,
    searchUsersFromSupabase,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    cancelFriendRequest,
    toggleCloseFriend,
    followBack,
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
  const [liveSearchResults, setLiveSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", userName: "", type: "success" });
  const toastAnim = useRef(new Animated.Value(-120)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

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

  const tabs: TabType[] = ["friends", "followers", "requests", "discover"];
  const tabIndex = tabs.indexOf(activeTab);

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [tabIndex, tabIndicatorAnim]);

  const pendingRequests = useMemo(
    () => (user ? getPendingRequests(user.id) : []),
    [user, getPendingRequests]
  );

  const sentRequests = useMemo(
    () => (user ? getSentRequests(user.id) : []),
    [user, getSentRequests]
  );

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "discover") return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setLiveSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        console.log("[FriendsSearch] Searching Supabase for:", trimmed);
        const results = await searchUsersFromSupabase(trimmed, user.id);
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
    if (activeTab === "discover") {
      setLiveSearchResults([]);
      setSearchQuery("");
    }
  }, [activeTab]);

  const handleFollowBack = useCallback(
    async (follower: Friend) => {
      if (!user) return;
      const success = await followBack(follower.userId);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Followed back!", follower.name, "success");
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Already following", follower.name, "info");
      }
    },
    [user, followBack, showToast]
  );

  const handleFollow = useCallback(
    async (toUser: PublicUser) => {
      if (!user) return;
      const success = await sendFriendRequest(user, toUser);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Follow request sent!", toUser.name, "success");
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Already requested", toUser.name, "info");
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
      showToast("You are now friends!", req?.fromUserName ?? "User", "success");
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

  const handleCancelFollow = useCallback(
    (requestId: string, userName: string) => {
      Alert.alert("Unfollow", `Cancel follow request to ${userName}?`, [
        { text: "No", style: "cancel" },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: async () => {
            await cancelFriendRequest(requestId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showToast("Follow request cancelled", userName, "info");
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
      Alert.alert("Unfollow & Remove", `Remove ${friend.name} from your friends?`, [
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

  const closeFriendsCount = useMemo(() => friends.filter((f) => f.isCloseFriend).length, [friends]);

  const renderFollowerItem = useCallback(
    ({ item }: { item: Friend }) => (
      <View style={styles.card}>
        <View style={[styles.avatar, styles.followerAvatar]}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
        </View>
        <TouchableOpacity
          style={styles.followBackBtn}
          onPress={() => void handleFollowBack(item)}
          activeOpacity={0.7}
          testID={`follow-back-${item.userId}`}
        >
          <UserPlus size={14} color={Colors.white} />
          <Text style={styles.followBackBtnText}>Follow Back</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleFollowBack]
  );

  const renderFriendItem = useCallback(
    ({ item }: { item: Friend }) => (
      <View style={[styles.card, item.isCloseFriend && styles.cardCloseFriend]}>
        <TouchableOpacity
          style={[styles.avatar, item.isCloseFriend && styles.avatarCloseFriend]}
          onPress={() => void handleToggleCloseFriend(item)}
          activeOpacity={0.7}
          testID={`close-friend-toggle-${item.userId}`}
        >
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
          {item.isCloseFriend && (
            <View style={styles.closeBadge}>
              <Heart size={8} color="#FF6B8A" fill="#FF6B8A" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            {item.isCloseFriend && (
              <View style={styles.closeTag}>
                <Heart size={8} color="#FF6B8A" fill="#FF6B8A" />
                <Text style={styles.closeTagText}>Close</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.iconBtn, item.isCloseFriend ? styles.iconBtnCloseFriendActive : null]}
            onPress={() => void handleToggleCloseFriend(item)}
            activeOpacity={0.7}
          >
            <Heart
              size={15}
              color={item.isCloseFriend ? "#FF6B8A" : Colors.textMuted}
              fill={item.isCloseFriend ? "#FF6B8A" : "transparent"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnChat]}
            onPress={() => void handleStartChat(item)}
            activeOpacity={0.7}
          >
            <MessageCircle size={15} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleRemoveFriend(item)}
            activeOpacity={0.7}
          >
            <UserMinus size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleStartChat, handleRemoveFriend, handleToggleCloseFriend]
  );

  const renderRequestItem = useCallback(
    ({ item }: { item: FriendRequest }) => (
      <View style={styles.requestCard}>
        <View style={styles.requestAvatarWrap}>
          <View style={styles.requestAvatar}>
            <Text style={styles.avatarText}>
              {item.fromUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.requestFollowIcon}>
            <UserPlus size={10} color={Colors.white} />
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.fromUserName}</Text>
          <Text style={styles.requestLabel}>wants to follow you</Text>
          <Text style={styles.requestTime}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => void handleAccept(item.id)}
            activeOpacity={0.7}
          >
            <Check size={16} color={Colors.white} />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => void handleReject(item.id)}
            activeOpacity={0.7}
          >
            <X size={16} color={Colors.textMuted} />
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
        <View style={styles.card}>
          <View style={[styles.avatar, styles.searchAvatar]}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{item.name}</Text>
              {isOwnerUser && (
                <View style={styles.ownerBadge}>
                  <Store size={9} color={Colors.star} />
                  <Text style={styles.ownerBadgeText}>Biz</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardEmail}>{item.email}</Text>
          </View>
          {alreadyFriend ? (
            <View style={styles.friendsBadge}>
              <UserCheck size={13} color={Colors.success} />
              <Text style={styles.friendsBadgeText}>Friends</Text>
            </View>
          ) : pendingReq ? (
            <View style={styles.followingBadge}>
              <Clock size={13} color={Colors.warning} />
              <Text style={styles.followingBadgeText}>Requested</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.followBtn}
              onPress={() => void handleFollow(item)}
              activeOpacity={0.7}
            >
              <UserPlus size={14} color={Colors.white} />
              <Text style={styles.followBtnText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isFriend, hasPendingRequest, user, handleFollow]
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Connect</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Users size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to connect</Text>
          <Text style={styles.emptySubtitle}>Follow people, make friends, and chat</Text>
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

  const tabWidth = (SCREEN_WIDTH - 40) / 4;

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case "friends": return "Friends";
      case "followers": return "Followers";
      case "requests": return "Requests";
      case "discover": return "Discover";
    }
  };

  const getTabCount = (tab: TabType) => {
    switch (tab) {
      case "friends": return friends.length;
      case "followers": return followers.length;
      case "requests": return pendingRequests.length + sentRequests.length;
      case "discover": return 0;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Connect</Text>
        {pendingRequests.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{pendingRequests.length}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.closeFriendsRow}
        onPress={() => expoRouter.push("/(tabs)/friends/close-friends" as any)}
        activeOpacity={0.7}
        testID="close-friends-list-btn"
      >
        <View style={styles.closeFriendsLeft}>
          <View style={styles.closeFriendsIcon}>
            <Heart size={16} color="#FF6B8A" fill="#FF6B8A" />
          </View>
          <View>
            <Text style={styles.closeFriendsTitle}>Close Friends</Text>
            <Text style={styles.closeFriendsSubtitle}>
              {closeFriendsCount} {closeFriendsCount === 1 ? "person" : "people"}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: tabWidth - 4,
              transform: [
                {
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1, 2, 3],
                    outputRange: [2, tabWidth + 2, tabWidth * 2 + 2, tabWidth * 3 + 2],
                  }),
                },
              ],
            },
          ]}
        />
        {tabs.map((tab) => {
          const count = getTabCount(tab);
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, { width: tabWidth }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {getTabLabel(tab)}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, activeTab === tab && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "followers" && (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowerItem}
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
              <View style={styles.emptyIconWrap}>
                <Users size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No followers yet</Text>
              <Text style={styles.emptySubtitle}>
                When people follow you, they{"\n"}will appear here
              </Text>
            </View>
          }
        />
      )}

      {activeTab === "discover" && (
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
              <View style={styles.emptyIconWrap}>
                <Users size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptySubtitle}>
                Follow people in the Discover tab.{"\n"}When they accept, you become friends!
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setActiveTab("discover")}
                activeOpacity={0.8}
              >
                <Search size={16} color={Colors.white} />
                <Text style={styles.emptyActionBtnText}>Discover People</Text>
              </TouchableOpacity>
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
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchUsers}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            sentRequests.length > 0 ? (
              <View style={styles.sentSection}>
                <Text style={styles.sectionLabel}>PENDING FOLLOWS</Text>
                <Text style={styles.sectionHint}>Waiting for them to accept your follow</Text>
                {sentRequests.map((req) => (
                  <View key={req.id} style={styles.sentCard}>
                    <View style={[styles.avatar, styles.sentAvatar]}>
                      <Text style={styles.avatarTextSmall}>{req.toUserName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{req.toUserName}</Text>
                      <Text style={styles.sentStatus}>Awaiting approval</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unfollowBtn}
                      onPress={() => handleCancelFollow(req.id, req.toUserName)}
                      activeOpacity={0.7}
                    >
                      <X size={12} color={Colors.error} />
                      <Text style={styles.unfollowBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {pendingRequests.length > 0 && (
                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>FOLLOW REQUESTS</Text>
                )}
              </View>
            ) : pendingRequests.length > 0 ? (
              <Text style={[styles.sectionLabel, { marginLeft: 0, marginBottom: 12 }]}>FOLLOW REQUESTS</Text>
            ) : null
          }
          ListEmptyComponent={
            sentRequests.length === 0 ? (
              <View style={styles.emptyCenter}>
                <View style={styles.emptyIconWrap}>
                  <Bell size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No requests</Text>
                <Text style={styles.emptySubtitle}>
                  Follow requests will appear here
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {activeTab === "discover" && (
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
                <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Searching...</Text>
              </View>
            ) : searchQuery.trim().length === 0 ? (
              <View style={styles.emptyCenter}>
                <View style={styles.emptyIconWrap}>
                  <Search size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Discover People</Text>
                <Text style={styles.emptySubtitle}>
                  Search by name or email to find{"\n"}and follow people
                </Text>
              </View>
            ) : (
              <View style={styles.emptyCenter}>
                <View style={styles.emptyIconWrap}>
                  <Search size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No one found</Text>
                <Text style={styles.emptySubtitle}>Try a different name or email</Text>
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
                <UserCheck size={16} color="#fff" />
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
    paddingBottom: 6,
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  closeFriendsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,107,138,0.15)",
  },
  closeFriendsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeFriendsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,107,138,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeFriendsTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  closeFriendsSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 2,
    position: "relative" as const,
  },
  tabIndicator: {
    position: "absolute" as const,
    top: 2,
    bottom: 2,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 5,
    zIndex: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabCount: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  tabCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.textMuted,
  },
  tabCountTextActive: {
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardCloseFriend: {
    borderColor: "rgba(255,107,138,0.2)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCloseFriend: {
    backgroundColor: "#C2185B",
  },
  searchAvatar: {
    backgroundColor: Colors.surfaceHighlight,
  },
  followerAvatar: {
    backgroundColor: "#1565C0",
  },
  sentAvatar: {
    backgroundColor: Colors.surfaceLight,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  avatarTextSmall: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  closeBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,107,138,0.3)",
  },
  closeTag: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,107,138,0.12)",
  },
  closeTagText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#FF6B8A",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  cardEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,184,0,0.12)",
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.star,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnChat: {
    backgroundColor: "#1E88E5",
  },
  iconBtnCloseFriendActive: {
    backgroundColor: "rgba(255,107,138,0.15)",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.15)",
  },
  requestAvatarWrap: {
    position: "relative" as const,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  requestFollowIcon: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  requestLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  requestTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.success,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  followBackBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1565C0",
  },
  followBackBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  friendsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(76,175,80,0.1)",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.2)",
  },
  friendsBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  followingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,152,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,152,0,0.2)",
  },
  followingBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.warning,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  sentSection: {
    marginBottom: 8,
  },
  sentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  sentStatus: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 1,
  },
  unfollowBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(230,57,70,0.1)",
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
  },
  unfollowBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  emptyCenter: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    marginTop: 24,
  },
  emptyActionBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
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
