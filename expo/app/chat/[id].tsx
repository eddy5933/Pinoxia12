import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ArrowLeft,
  Send,
  MapPin,
  Navigation,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useChat } from "@/providers/ChatProvider";
import { useLocation } from "@/providers/LocationProvider";
import { ChatMessage } from "@/types";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const {
    getMessagesForConversation,
    sendMessage,
    conversations,
    startSharingLocation,
    stopSharingLocation,
    getLiveLocationsForConversation,
    updateSharedLocation,
    setActiveConversation,
  } = useChat();
  const { userLocation, requestLocation } = useLocation();

  const [inputText, setInputText] = useState("");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === id),
    [conversations, id]
  );

  const chatMessages = useMemo(
    () => (id ? getMessagesForConversation(id) : []),
    [id, getMessagesForConversation]
  );

  const liveLocations = useMemo(
    () => (id ? getLiveLocationsForConversation(id) : []),
    [id, getLiveLocationsForConversation]
  );

  const otherParticipantName = useMemo(() => {
    if (!conversation || !user) return "Chat";
    const otherId = conversation.participants.find((p) => p !== user.id);
    return otherId ? (conversation.participantNames[otherId] ?? "Friend") : "Friend";
  }, [conversation, user]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !user || !id) return;
    const msg = await sendMessage(id, user.id, user.name, inputText.trim());
    if (msg) {
      setInputText("");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [inputText, user, id, sendMessage]);

  const handleShareLocation = useCallback(() => {
    if (!user || !id) return;

    if (isSharingLocation) {
      stopSharingLocation(user.id, id);
      setIsSharingLocation(false);
      if (locationTimerRef.current) {
        clearInterval(locationTimerRef.current);
        locationTimerRef.current = null;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!userLocation) {
      Alert.alert("Location Required", "Please enable location to share your position.", [
        { text: "Cancel", style: "cancel" },
        { text: "Enable", onPress: () => void requestLocation() },
      ]);
      return;
    }

    startSharingLocation(
      user.id,
      user.name,
      id,
      userLocation.latitude,
      userLocation.longitude,
      userLocation.placeName
    );
    setIsSharingLocation(true);

    void sendMessage(
      id,
      user.id,
      user.name,
      `📍 Sharing live location${userLocation.placeName ? ` near ${userLocation.placeName}` : ""}`,
      "location",
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        placeName: userLocation.placeName,
      }
    ).catch((err) => console.warn("[Chat] Location share message error:", err));

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    locationTimerRef.current = setInterval(async () => {
      await requestLocation();
      if (userLocation) {
        updateSharedLocation(user.id, id, userLocation.latitude, userLocation.longitude, userLocation.placeName);
      }
    }, 15000);
  }, [user, id, isSharingLocation, userLocation, startSharingLocation, stopSharingLocation, sendMessage, requestLocation, updateSharedLocation]);

  useEffect(() => {
    const timer = locationTimerRef;
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (id) {
      setActiveConversation(id);
    }
    return () => {
      setActiveConversation(null);
    };
  }, [id, setActiveConversation]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [chatMessages.length]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.senderId === user?.id;
      const isLocationMsg = item.type === "location";

      return (
        <View
          style={[
            styles.messageBubbleContainer,
            isMe ? styles.myMessageContainer : styles.otherMessageContainer,
          ]}
        >
          {!isMe && (
            <View style={styles.senderAvatar}>
              <Text style={styles.senderAvatarText}>
                {item.senderName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.myMessage : styles.otherMessage,
              isLocationMsg && styles.locationMessage,
            ]}
          >
            {isLocationMsg && (
              <View style={styles.locationHeader}>
                <Navigation size={14} color={isMe ? Colors.white : "#1E88E5"} />
                <Text style={[styles.locationLabel, isMe && styles.myLocationLabel]}>
                  Live Location
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                isMe ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.text}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMe ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      );
    },
    [user]
  );

  if (!conversation || !user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>Conversation not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <View style={styles.chatHeaderAvatar}>
            <Text style={styles.chatHeaderAvatarText}>
              {otherParticipantName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.chatHeaderName}>{otherParticipantName}</Text>
            {liveLocations.length > 0 && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveIndicatorDot} />
                <Text style={styles.liveIndicatorText}>
                  {liveLocations.length} sharing location
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {liveLocations.length > 0 && (
        <View style={styles.liveLocationBanner}>
          {liveLocations.map((loc) => (
            <View key={`${loc.userId}_${loc.conversationId}`} style={styles.liveLocationItem}>
              <MapPin size={14} color="#1E88E5" />
              <Text style={styles.liveLocationText} numberOfLines={1}>
                {loc.userName}: {loc.placeName || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
              <Text style={styles.emptyMessagesSubtext}>
                Send a message to start chatting!
              </Text>
            </View>
          }
        />

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[
              styles.locationButton,
              isSharingLocation && styles.locationButtonActive,
            ]}
            onPress={handleShareLocation}
            activeOpacity={0.7}
          >
            {isSharingLocation ? (
              <X size={20} color={Colors.white} />
            ) : (
              <Navigation size={20} color="#1E88E5" />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={() => void handleSend()}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Send size={18} color={inputText.trim() ? Colors.white : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surfaceHighlight,
  },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    flex: 1,
    gap: 10,
  },
  chatHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderAvatarText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  liveIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4CAF50",
  },
  liveIndicatorText: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "500" as const,
  },
  liveLocationBanner: {
    backgroundColor: "rgba(30,136,229,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30,136,229,0.2)",
    gap: 6,
  },
  liveLocationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveLocationText: {
    flex: 1,
    fontSize: 13,
    color: "#1E88E5",
    fontWeight: "500" as const,
  },
  chatBody: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageBubbleContainer: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-end",
  },
  myMessageContainer: {
    justifyContent: "flex-end",
  },
  otherMessageContainer: {
    justifyContent: "flex-start",
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  senderAvatarText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessage: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    marginLeft: "auto",
  },
  otherMessage: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationMessage: {
    borderWidth: 1,
    borderColor: "rgba(30,136,229,0.3)",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#1E88E5",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  myLocationLabel: {
    color: "rgba(255,255,255,0.8)",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.white,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "right" as const,
  },
  otherMessageTime: {
    color: Colors.textMuted,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  locationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  locationButtonActive: {
    backgroundColor: "#1E88E5",
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 42,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surfaceHighlight,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backLink: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  backLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  emptyMessages: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyMessagesText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  emptyMessagesSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
  },
});
