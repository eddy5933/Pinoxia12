import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Home,
  ChevronLeft,
  MessageCircle,
  UserMinus,
  Users,
  Sparkles,
  Plus,
  Search,
  X,
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

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { friends, familyMembers, toggleFamily, removeFriend } = useFriends();
  const { getOrCreateConversation } = useChat();

  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
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

  const nonFamilyFriends = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    const filtered = friends.filter((f) => !f.isFamily);
    if (!q) return filtered;
    return filtered.filter(
      (f) => f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
    );
  }, [friends, addSearch]);

  const handleRemoveFamily = useCallback(
    async (friend: Friend) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleFamily(friend.id);
      showToast(`${friend.name} removed from family`, "info");
    },
    [toggleFamily, showToast]
  );

  const handleAddToFamily = useCallback(
    async (friend: Friend) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleFamily(friend.id);
      showToast(`${friend.name} added to family`, "success");
    },
    [toggleFamily, showToast]
  );

  const handleStartChat = useCallback(
    async (friend: Friend) => {
      if (!user) return;
      const convo = await getOrCreateConversation(user.id, user.name, friend.userId, friend.name);
      router.push(`/chat/${convo.id}` as any);
    },
    [user, getOrCreateConversation, router]
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

  const renderItem = useCallback(
    ({ item, index }: { item: Friend; index: number }) => (
      <View style={[styles.card, index === 0 && styles.cardFirst]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.familyBadge}>
            <Home size={9} color="#4FC3F7" fill="#4FC3F7" />
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
            testID={`family-chat-${item.userId}`}
          >
            <MessageCircle size={16} color="#1E88E5" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnFamily]}
            onPress={() => void handleRemoveFamily(item)}
            activeOpacity={0.7}
            testID={`family-remove-star-${item.userId}`}
          >
            <Home size={16} color="#4FC3F7" fill="#4FC3F7" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => handleRemoveFriend(item)}
            activeOpacity={0.7}
            testID={`family-remove-${item.userId}`}
          >
            <UserMinus size={14} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleStartChat, handleRemoveFamily, handleRemoveFriend]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          testID="family-back"
        >
          <ChevronLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Home size={18} color="#4FC3F7" fill="#4FC3F7" />
          <Text style={styles.headerTitle}>Family</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{familyMembers.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setShowAddModal(true); setAddSearch(""); }}
          activeOpacity={0.7}
          testID="family-add-btn"
        >
          <Plus size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.descriptionBar}>
        <Home size={14} color={Colors.textMuted} />
        <Text style={styles.descriptionText}>
          Family members you trust and stay connected with
        </Text>
      </View>

      <FlatList
        data={familyMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Sparkles size={32} color="#4FC3F7" />
            </View>
            <Text style={styles.emptyTitle}>No family members yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the family icon on any friend to add them to your family list
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

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Home size={18} color="#4FC3F7" fill="#4FC3F7" />
                <Text style={styles.modalTitle}>Add to Family</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.7}
                testID="family-modal-close"
              >
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchWrap}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search friends..."
                placeholderTextColor={Colors.textMuted}
                value={addSearch}
                onChangeText={setAddSearch}
                autoCapitalize="none"
                testID="family-add-search"
              />
              {addSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAddSearch("")} activeOpacity={0.7}>
                  <X size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={nonFamilyFriends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.modalCard}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.modalEmail} numberOfLines={1}>{item.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalAddBtn}
                    onPress={() => void handleAddToFamily(item)}
                    activeOpacity={0.7}
                    testID={`family-add-${item.userId}`}
                  >
                    <Plus size={14} color={Colors.white} />
                    <Text style={styles.modalAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Users size={28} color={Colors.textMuted} />
                  <Text style={styles.modalEmptyText}>
                    {friends.length === 0
                      ? "No friends yet. Add friends first!"
                      : nonFamilyFriends.length === 0 && addSearch.trim()
                      ? "No matching friends found"
                      : "All friends are already in family"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

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
            <Home size={14} color="#4FC3F7" fill={toast.type === "success" ? "#4FC3F7" : "transparent"} />
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
    backgroundColor: "rgba(79,195,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.3)",
  },
  countText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#4FC3F7",
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
    borderColor: "rgba(79,195,247,0.18)",
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
    backgroundColor: "#0277BD",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 19,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  familyBadge: {
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
    borderColor: "rgba(79,195,247,0.4)",
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
  actionBtnFamily: {
    backgroundColor: "rgba(79,195,247,0.12)",
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
    backgroundColor: "rgba(79,195,247,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.2)",
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
    backgroundColor: "#1B2A3A",
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.25)",
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(79,195,247,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.3)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
    paddingVertical: 10,
  },
  modalListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  modalAvatarText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  modalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modalName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  modalEmail: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(79,195,247,0.2)",
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.3)",
  },
  modalAddBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#4FC3F7",
  },
  modalEmpty: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 30,
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
