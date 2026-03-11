import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, MessageCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useChat } from "@/providers/ChatProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { Conversation } from "@/types";

export default function ChatsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, getUnreadCount } = useChat();
  const { friends } = useFriends();

  const sortedConversations = useMemo(() => {
    if (!user) return [];
    return conversations
      .filter((c) => c.participants.includes(user.id))
      .sort((a, b) => {
        const aTime = a.lastMessageAt || "0";
        const bTime = b.lastMessageAt || "0";
        return bTime.localeCompare(aTime);
      });
  }, [conversations, user]);

  const getOtherParticipant = useCallback(
    (convo: Conversation) => {
      if (!user) return { name: "Unknown", id: "" };
      const otherId = convo.participants.find((p) => p !== user.id) ?? "";
      const name = convo.participantNames[otherId] ?? "Friend";
      return { name, id: otherId };
    },
    [user]
  );

  const isFriendOnline = useCallback(
    (userId: string) => {
      const friend = friends.find((f) => f.userId === userId);
      return friend?.isOnline ?? false;
    },
    [friends]
  );

  const formatTime = useCallback((dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }, []);

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => {
      const other = getOtherParticipant(item);
      const unread = getUnreadCount(item.id);
      const isOnline = isFriendOnline(other.id);

      return (
        <TouchableOpacity
          style={[styles.chatCard, unread > 0 && styles.chatCardUnread]}
          onPress={() => router.push(`/chat/${item.id}` as any)}
          activeOpacity={0.7}
          testID={`chat-item-${item.id}`}
        >
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, unread > 0 && styles.avatarUnread]}>
              <Text style={styles.avatarText}>
                {other.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            {isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatTopRow}>
              <Text
                style={[styles.chatName, unread > 0 && styles.chatNameUnread]}
                numberOfLines={1}
              >
                {other.name}
              </Text>
              <Text style={[styles.chatTime, unread > 0 && styles.chatTimeUnread]}>
                {formatTime(item.lastMessageAt)}
              </Text>
            </View>
            <View style={styles.chatBottomRow}>
              <Text
                style={[styles.chatLastMsg, unread > 0 && styles.chatLastMsgUnread]}
                numberOfLines={1}
              >
                {item.lastMessage || "No messages yet"}
              </Text>
              {unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [getOtherParticipant, getUnreadCount, isFriendOnline, formatTime, router]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={sortedConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <View style={styles.emptyIconWrap}>
              <MessageCircle size={36} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start chatting with your friends{"\n"}from the Friends tab
            </Text>
          </View>
        }
      />
    </View>
  );
}

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
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatCardUnread: {
    borderColor: "rgba(30,136,229,0.25)",
    backgroundColor: "#141C26",
  },
  avatarContainer: {
    position: "relative" as const,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1565C0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarUnread: {
    backgroundColor: "#1E88E5",
  },
  avatarText: {
    fontSize: 19,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  onlineDot: {
    position: "absolute" as const,
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2.5,
    borderColor: Colors.surface,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  chatTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  chatNameUnread: {
    fontWeight: "700" as const,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  chatTimeUnread: {
    color: "#1E88E5",
    fontWeight: "600" as const,
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatLastMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  chatLastMsgUnread: {
    color: Colors.white,
    fontWeight: "500" as const,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  emptyCenter: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
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
});
