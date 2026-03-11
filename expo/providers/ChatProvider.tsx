import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChatMessage, Conversation } from "@/types";

const CONVERSATIONS_KEY = "foodspot_conversations";
const MESSAGES_KEY = "foodspot_messages";
const LIVE_LOCATIONS_KEY = "foodspot_live_locations";

export interface LiveLocation {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  placeName?: string;
  updatedAt: string;
  conversationId: string;
  isSharing: boolean;
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadQuery = useQuery({
    queryKey: ["chat_load"],
    queryFn: async () => {
      console.log("[ChatProvider] Loading data...");
      const [storedConvos, storedMessages, storedLocations] = await Promise.all([
        AsyncStorage.getItem(CONVERSATIONS_KEY),
        AsyncStorage.getItem(MESSAGES_KEY),
        AsyncStorage.getItem(LIVE_LOCATIONS_KEY),
      ]);

      const loadedConversations: Conversation[] = storedConvos ? JSON.parse(storedConvos) : [];
      const loadedMessages: ChatMessage[] = storedMessages ? JSON.parse(storedMessages) : [];
      const loadedLocations: LiveLocation[] = storedLocations ? JSON.parse(storedLocations) : [];

      console.log("[ChatProvider] Loaded", loadedConversations.length, "conversations,", loadedMessages.length, "messages");
      return { conversations: loadedConversations, messages: loadedMessages, liveLocations: loadedLocations };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setConversations(loadQuery.data.conversations);
      setMessages(loadQuery.data.messages);
      setLiveLocations(loadQuery.data.liveLocations);
    }
  }, [loadQuery.data]);

  const persistConversations = useMutation({
    mutationFn: async (updated: Conversation[]) => {
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
    },
  });

  const persistMessages = useMutation({
    mutationFn: async (updated: ChatMessage[]) => {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
    },
  });

  const persistLiveLocations = useMutation({
    mutationFn: async (updated: LiveLocation[]) => {
      await AsyncStorage.setItem(LIVE_LOCATIONS_KEY, JSON.stringify(updated));
    },
  });

  const getOrCreateConversation = useCallback(
    (currentUserId: string, currentUserName: string, friendUserId: string, friendName: string) => {
      const existing = conversations.find(
        (c) => c.participants.includes(currentUserId) && c.participants.includes(friendUserId)
      );
      if (existing) return existing;

      const newConvo: Conversation = {
        id: `conv_${Date.now()}`,
        participants: [currentUserId, friendUserId],
        participantNames: { [currentUserId]: currentUserName, [friendUserId]: friendName },
        unreadCount: 0,
      };
      const updated = [newConvo, ...conversations];
      setConversations(updated);
      persistConversations.mutate(updated);
      console.log("[ChatProvider] Created conversation between", currentUserName, "and", friendName);
      return newConvo;
    },
    [conversations, persistConversations]
  );

  const sendMessage = useCallback(
    (conversationId: string, senderId: string, senderName: string, text: string, type: "text" | "location" = "text", locationData?: ChatMessage["locationData"]) => {
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        conversationId,
        senderId,
        senderName,
        text,
        type,
        locationData,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      persistMessages.mutate(updatedMessages);

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: text, lastMessageAt: newMessage.createdAt }
            : c
        );
        persistConversations.mutate(updated);
        return updated;
      });

      console.log("[ChatProvider] Sent message in", conversationId);
      return newMessage;
    },
    [messages, persistMessages, persistConversations]
  );

  const getMessagesForConversation = useCallback(
    (conversationId: string) =>
      messages.filter((m) => m.conversationId === conversationId),
    [messages]
  );

  const getConversationsForUser = useCallback(
    (userId: string) =>
      conversations
        .filter((c) => c.participants.includes(userId))
        .sort((a, b) => {
          const aTime = a.lastMessageAt || "0";
          const bTime = b.lastMessageAt || "0";
          return bTime.localeCompare(aTime);
        }),
    [conversations]
  );

  const startSharingLocation = useCallback(
    (userId: string, userName: string, conversationId: string, latitude: number, longitude: number, placeName?: string) => {
      const newLocation: LiveLocation = {
        userId,
        userName,
        latitude,
        longitude,
        placeName,
        updatedAt: new Date().toISOString(),
        conversationId,
        isSharing: true,
      };

      setLiveLocations((prev) => {
        const filtered = prev.filter(
          (l) => !(l.userId === userId && l.conversationId === conversationId)
        );
        const updated = [...filtered, newLocation];
        persistLiveLocations.mutate(updated);
        return updated;
      });

      console.log("[ChatProvider] Started sharing location for", userName);
    },
    [persistLiveLocations]
  );

  const updateSharedLocation = useCallback(
    (userId: string, conversationId: string, latitude: number, longitude: number, placeName?: string) => {
      setLiveLocations((prev) => {
        const updated = prev.map((l) =>
          l.userId === userId && l.conversationId === conversationId
            ? { ...l, latitude, longitude, placeName, updatedAt: new Date().toISOString() }
            : l
        );
        persistLiveLocations.mutate(updated);
        return updated;
      });
    },
    [persistLiveLocations]
  );

  const stopSharingLocation = useCallback(
    (userId: string, conversationId: string) => {
      setLiveLocations((prev) => {
        const updated = prev.filter(
          (l) => !(l.userId === userId && l.conversationId === conversationId)
        );
        persistLiveLocations.mutate(updated);
        return updated;
      });
      console.log("[ChatProvider] Stopped sharing location");
    },
    [persistLiveLocations]
  );

  const getLiveLocationsForConversation = useCallback(
    (conversationId: string) =>
      liveLocations.filter((l) => l.conversationId === conversationId && l.isSharing),
    [liveLocations]
  );

  const isUserSharingLocation = useCallback(
    (userId: string, conversationId: string) =>
      liveLocations.some(
        (l) => l.userId === userId && l.conversationId === conversationId && l.isSharing
      ),
    [liveLocations]
  );

  useEffect(() => {
    const ref = locationIntervalRef;
    return () => {
      if (ref.current) {
        clearInterval(ref.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      conversations,
      messages,
      liveLocations,
      getOrCreateConversation,
      sendMessage,
      getMessagesForConversation,
      getConversationsForUser,
      startSharingLocation,
      updateSharedLocation,
      stopSharingLocation,
      getLiveLocationsForConversation,
      isUserSharingLocation,
    }),
    [
      conversations, messages, liveLocations,
      getOrCreateConversation, sendMessage,
      getMessagesForConversation, getConversationsForUser,
      startSharingLocation, updateSharedLocation, stopSharingLocation,
      getLiveLocationsForConversation, isUserSharingLocation,
    ]
  );
});
