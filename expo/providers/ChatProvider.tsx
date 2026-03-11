import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatMessage, Conversation } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { Alert } from "react-native";

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

const EMPTY_CONVOS: Conversation[] = [];
const EMPTY_MSGS: ChatMessage[] = [];

export const [ChatProvider, useChat] = createContextHook(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>(EMPTY_CONVOS);
  const messagesRef = useRef<ChatMessage[]>(EMPTY_MSGS);

  const conversationsQuery = useQuery({
    queryKey: ["chat_conversations", user?.id],
    queryFn: async (): Promise<Conversation[]> => {
      if (!user) return [];
      console.log("[Chat] Fetching conversations for:", user.id);

      const { data, error } = await supabase
        .from("conversations")
        .select("*");

      if (error) {
        console.warn("[Chat] Conversations error:", error.message);
        return [];
      }

      const convos: Conversation[] = (data ?? [])
        .filter((c: any) => {
          const parts: string[] = c.participants ?? [];
          return parts.includes(user.id);
        })
        .map((c: any) => ({
          id: c.id,
          participants: c.participants ?? [],
          participantNames: c.participant_names ?? {},
          lastMessage: c.last_message ?? undefined,
          lastMessageAt: c.last_message_at ?? undefined,
          unreadCount: c.unread_count ?? 0,
        }));

      console.log("[Chat] Loaded", convos.length, "conversations");
      return convos;
    },
    enabled: !!user?.id,
    staleTime: 2000,
    refetchInterval: 5000,
  });

  const currentConversations = conversationsQuery.data ?? EMPTY_CONVOS;
  conversationsRef.current = currentConversations;

  const convoIds = useMemo(
    () => currentConversations.map((c) => c.id),
    [currentConversations]
  );

  const messagesQuery = useQuery({
    queryKey: ["chat_messages", convoIds],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (convoIds.length === 0) return [];
      console.log("[Chat] Fetching messages for", convoIds.length, "conversations");

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("[Chat] Messages error:", error.message);
        return [];
      }

      const msgs: ChatMessage[] = (data ?? []).map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        text: m.text,
        type: m.type ?? "text",
        locationData: m.location_data ?? undefined,
        createdAt: m.created_at,
      }));

      console.log("[Chat] Loaded", msgs.length, "messages");
      return msgs;
    },
    enabled: convoIds.length > 0,
    staleTime: 2000,
    refetchInterval: 5000,
  });

  const currentMessages = messagesQuery.data ?? EMPTY_MSGS;
  messagesRef.current = currentMessages;

  useEffect(() => {
    if (!user?.id) return;
    console.log("[Chat] Setting up realtime for:", user.id);

    const channel = supabase
      .channel(`chat_rt_${user.id}_${Date.now()}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const m = payload.new;
        if (!m) return;
        console.log("[Chat] RT new message:", m.id, "from:", m.sender_name);

        void queryClient.invalidateQueries({ queryKey: ["chat_messages"] });
        void queryClient.invalidateQueries({ queryKey: ["chat_conversations", user.id] });

        if (m.sender_id !== user.id && activeConversationRef.current !== m.conversation_id) {
          setUnreadCounts((prev) => ({
            ...prev,
            [m.conversation_id]: (prev[m.conversation_id] ?? 0) + 1,
          }));
        }
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "conversations" }, (payload: any) => {
        const c = payload.new;
        if (!c) return;
        const participants: string[] = c.participants ?? [];
        if (!participants.includes(user.id)) return;
        console.log("[Chat] RT conversation change:", c.id);
        void queryClient.invalidateQueries({ queryKey: ["chat_conversations", user.id] });
      })
      .subscribe((status: string) => {
        console.log("[Chat] RT subscription:", status);
      });

    return () => {
      console.log("[Chat] Cleaning up RT");
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getOrCreateConversation = useCallback(
    async (currentUserId: string, currentUserName: string, friendUserId: string, friendName: string) => {
      const localExisting = conversationsRef.current.find(
        (c) => c.participants.includes(currentUserId) && c.participants.includes(friendUserId)
      );
      if (localExisting) {
        console.log("[Chat] Found conversation locally:", localExisting.id);
        return localExisting;
      }

      console.log("[Chat] Checking DB for conversation between", currentUserId, "and", friendUserId);

      const { data: dbConvos, error: dbError } = await supabase
        .from("conversations")
        .select("*");

      if (dbError) {
        console.warn("[Chat] DB query error:", dbError.message, dbError.code, dbError.details, dbError.hint);
      }

      const matchingConvo = (dbConvos ?? []).find(
        (c: any) => {
          const parts: string[] = c.participants ?? [];
          return parts.includes(currentUserId) && parts.includes(friendUserId);
        }
      );

      if (matchingConvo) {
        console.log("[Chat] Found in DB:", matchingConvo.id);
        const convo: Conversation = {
          id: matchingConvo.id,
          participants: matchingConvo.participants ?? [],
          participantNames: matchingConvo.participant_names ?? {},
          lastMessage: matchingConvo.last_message ?? undefined,
          lastMessageAt: matchingConvo.last_message_at ?? undefined,
          unreadCount: matchingConvo.unread_count ?? 0,
        };
        void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
        return convo;
      }

      console.log("[Chat] Creating new conversation:", currentUserName, "<->", friendName);
      const participantNames: Record<string, string> = {
        [currentUserId]: currentUserName,
        [friendUserId]: friendName,
      };

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          participants: [currentUserId, friendUserId],
          participant_names: participantNames,
          last_message: null,
          last_message_at: null,
          unread_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.warn("[Chat] Create conversation error:", error.message, "code:", error.code, "details:", error.details, "hint:", error.hint);

        const { data: allConvos } = await supabase
          .from("conversations")
          .select("*");

        const retryMatch = (allConvos ?? []).find(
          (c: any) => {
            const parts: string[] = c.participants ?? [];
            return parts.includes(currentUserId) && parts.includes(friendUserId);
          }
        );

        if (retryMatch) {
          console.log("[Chat] Found on retry:", retryMatch.id);
          const retryConvo: Conversation = {
            id: retryMatch.id,
            participants: retryMatch.participants ?? [],
            participantNames: retryMatch.participant_names ?? {},
            lastMessage: retryMatch.last_message ?? undefined,
            lastMessageAt: retryMatch.last_message_at ?? undefined,
            unreadCount: retryMatch.unread_count ?? 0,
          };
          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
          return retryConvo;
        }

        Alert.alert(
          "Chat Error",
          `Could not create conversation: ${error.message}. Make sure your Supabase conversations table has the correct RLS policies.`
        );
        throw new Error("Failed to create conversation: " + error.message);
      }

      const newConvo: Conversation = {
        id: data.id,
        participants: data.participants,
        participantNames: data.participant_names,
        unreadCount: 0,
      };

      console.log("[Chat] Created conversation:", newConvo.id);
      void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
      return newConvo;
    },
    [queryClient]
  );

  const sendMessage = useCallback(
    async (
      conversationId: string,
      senderId: string,
      senderName: string,
      text: string,
      type: "text" | "location" = "text",
      locationData?: ChatMessage["locationData"]
    ) => {
      if (conversationId.startsWith("conv_")) {
        console.warn("[Chat] Cannot send to local-only conversation:", conversationId);
        Alert.alert("Chat Error", "This conversation wasn't saved properly. Please go back and try again.");
        return null;
      }

      console.log("[Chat] Sending message in", conversationId);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          sender_name: senderName,
          text,
          type,
          location_data: locationData ?? null,
        })
        .select()
        .single();

      if (error) {
        console.warn("[Chat] Send message error:", error.message);
        Alert.alert("Message Error", "Failed to send message.");
        return null;
      }

      const newMessage: ChatMessage = {
        id: data.id,
        conversationId,
        senderId,
        senderName,
        text,
        type,
        locationData: data.location_data ?? undefined,
        createdAt: data.created_at,
      };

      await supabase
        .from("conversations")
        .update({
          last_message: text,
          last_message_at: newMessage.createdAt,
        })
        .eq("id", conversationId);

      void queryClient.invalidateQueries({ queryKey: ["chat_messages"] });
      void queryClient.invalidateQueries({ queryKey: ["chat_conversations", senderId] });

      console.log("[Chat] Message sent:", data.id);
      return newMessage;
    },
    [queryClient]
  );

  const getMessagesForConversation = useCallback(
    (conversationId: string) => messagesRef.current.filter((m) => m.conversationId === conversationId),
    []
  );

  const getConversationsForUser = useCallback(
    (userId: string) =>
      conversationsRef.current
        .filter((c) => c.participants.includes(userId))
        .sort((a, b) => {
          const aTime = a.lastMessageAt || "0";
          const bTime = b.lastMessageAt || "0";
          return bTime.localeCompare(aTime);
        }),
    []
  );

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeConversationRef.current = conversationId;
    if (conversationId) {
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    }
  }, []);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCounts).reduce((sum, count) => sum + count, 0),
    [unreadCounts]
  );

  const getUnreadCount = useCallback(
    (conversationId: string) => unreadCounts[conversationId] ?? 0,
    [unreadCounts]
  );

  const startSharingLocation = useCallback(
    (userId: string, userName: string, conversationId: string, latitude: number, longitude: number, placeName?: string) => {
      const newLocation: LiveLocation = {
        userId, userName, latitude, longitude, placeName,
        updatedAt: new Date().toISOString(),
        conversationId, isSharing: true,
      };
      setLiveLocations((prev) => {
        const filtered = prev.filter((l) => !(l.userId === userId && l.conversationId === conversationId));
        return [...filtered, newLocation];
      });
      console.log("[Chat] Started sharing location for", userName);
    },
    []
  );

  const updateSharedLocation = useCallback(
    (userId: string, conversationId: string, latitude: number, longitude: number, placeName?: string) => {
      setLiveLocations((prev) =>
        prev.map((l) =>
          l.userId === userId && l.conversationId === conversationId
            ? { ...l, latitude, longitude, placeName, updatedAt: new Date().toISOString() }
            : l
        )
      );
    },
    []
  );

  const stopSharingLocation = useCallback(
    (userId: string, conversationId: string) => {
      setLiveLocations((prev) =>
        prev.filter((l) => !(l.userId === userId && l.conversationId === conversationId))
      );
      console.log("[Chat] Stopped sharing location");
    },
    []
  );

  const getLiveLocationsForConversation = useCallback(
    (conversationId: string) =>
      liveLocations.filter((l) => l.conversationId === conversationId && l.isSharing),
    [liveLocations]
  );

  const isUserSharingLocation = useCallback(
    (userId: string, conversationId: string) =>
      liveLocations.some((l) => l.userId === userId && l.conversationId === conversationId && l.isSharing),
    [liveLocations]
  );

  useEffect(() => {
    const ref = locationIntervalRef;
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, []);

  return useMemo(
    () => ({
      conversations: currentConversations,
      messages: currentMessages,
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
      setActiveConversation,
      totalUnreadCount,
      getUnreadCount,
    }),
    [
      currentConversations, currentMessages, liveLocations,
      getOrCreateConversation, sendMessage,
      getMessagesForConversation, getConversationsForUser,
      startSharingLocation, updateSharedLocation, stopSharingLocation,
      getLiveLocationsForConversation, isUserSharingLocation,
      setActiveConversation, totalUnreadCount, getUnreadCount,
    ]
  );
});
