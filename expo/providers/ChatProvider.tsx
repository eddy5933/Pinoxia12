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

export const [ChatProvider, useChat] = createContextHook(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const realtimeMessagesRef = useRef<ChatMessage[]>([]);
  const realtimeConvosRef = useRef<Conversation[]>([]);

  const conversationsQuery = useQuery({
    queryKey: ["chat_conversations", user?.id],
    queryFn: async (): Promise<Conversation[]> => {
      if (!user) return [];
      console.log("[ChatProvider] Fetching conversations for user:", user.id);

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [user.id]);

      if (error) {
        console.warn("[ChatProvider] Conversations query error:", error.message, error.details, error.hint);
        return [];
      }

      const convos: Conversation[] = (data ?? []).map((c: any) => ({
        id: c.id,
        participants: c.participants ?? [],
        participantNames: c.participant_names ?? {},
        lastMessage: c.last_message ?? undefined,
        lastMessageAt: c.last_message_at ?? undefined,
        unreadCount: c.unread_count ?? 0,
      }));

      console.log("[ChatProvider] Loaded", convos.length, "conversations");
      return convos;
    },
    enabled: !!user?.id,
    staleTime: 2000,
    refetchInterval: 4000,
  });

  const conversations = useMemo(() => {
    const polled = conversationsQuery.data ?? [];
    const realtimeExtras = realtimeConvosRef.current.filter(
      (rc) => !polled.some((p) => p.id === rc.id)
    );
    return [...polled, ...realtimeExtras];
  }, [conversationsQuery.data]);

  const convoIds = useMemo(() => conversations.map((c) => c.id), [conversations]);

  const messagesQuery = useQuery({
    queryKey: ["chat_messages", convoIds],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (convoIds.length === 0) return [];
      console.log("[ChatProvider] Fetching messages for", convoIds.length, "conversations");

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("[ChatProvider] Messages query error:", error.message, error.details, error.hint);
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

      console.log("[ChatProvider] Loaded", msgs.length, "messages");
      realtimeMessagesRef.current = [];
      return msgs;
    },
    enabled: convoIds.length > 0,
    staleTime: 2000,
    refetchInterval: 4000,
  });

  const messages = useMemo(() => {
    const polled = messagesQuery.data ?? [];
    const realtimeExtras = realtimeMessagesRef.current.filter(
      (rm) => !polled.some((p) => p.id === rm.id)
    );
    return [...polled, ...realtimeExtras];
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!user?.id) return;
    console.log("[ChatProvider] Setting up realtime subscription for user:", user.id);

    const channel = supabase
      .channel(`chat_rt_${user.id}_${Date.now()}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const m = payload.new;
          if (!m) return;
          console.log("[ChatProvider] RT new message:", m.id, "in conv:", m.conversation_id, "from:", m.sender_name);

          const newMsg: ChatMessage = {
            id: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            text: m.text,
            type: m.type ?? "text",
            locationData: m.location_data ?? undefined,
            createdAt: m.created_at,
          };

          realtimeMessagesRef.current = [
            ...realtimeMessagesRef.current.filter((rm) => rm.id !== newMsg.id),
            newMsg,
          ];

          void queryClient.invalidateQueries({ queryKey: ["chat_messages"] });
          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", user.id] });

          if (
            newMsg.senderId !== user.id &&
            activeConversationRef.current !== newMsg.conversationId
          ) {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.conversationId]: (prev[newMsg.conversationId] ?? 0) + 1,
            }));
          }
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload: any) => {
          const c = payload.new;
          if (!c) return;
          const participants: string[] = c.participants ?? [];
          if (!participants.includes(user.id)) return;
          console.log("[ChatProvider] RT new conversation:", c.id);

          const newConvo: Conversation = {
            id: c.id,
            participants,
            participantNames: c.participant_names ?? {},
            lastMessage: c.last_message ?? undefined,
            lastMessageAt: c.last_message_at ?? undefined,
            unreadCount: c.unread_count ?? 0,
          };

          realtimeConvosRef.current = [
            ...realtimeConvosRef.current.filter((rc) => rc.id !== newConvo.id),
            newConvo,
          ];

          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", user.id] });
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload: any) => {
          const c = payload.new;
          if (!c) return;
          console.log("[ChatProvider] RT conversation updated:", c.id);
          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", user.id] });
        }
      )
      .subscribe((status: string) => {
        console.log("[ChatProvider] RT subscription status:", status);
        if (status === "CHANNEL_ERROR") {
          console.warn("[ChatProvider] RT channel error - relying on polling");
        }
      });

    return () => {
      console.log("[ChatProvider] Cleaning up RT subscription");
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getOrCreateConversation = useCallback(
    async (currentUserId: string, currentUserName: string, friendUserId: string, friendName: string) => {
      const localExisting = conversations.find(
        (c) => c.participants.includes(currentUserId) && c.participants.includes(friendUserId)
      );
      if (localExisting) {
        console.log("[ChatProvider] Found conversation locally:", localExisting.id);
        return localExisting;
      }

      console.log("[ChatProvider] Checking Supabase for existing conversation...");
      const { data: dbConvos, error: dbError } = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [currentUserId])
        .contains("participants", [friendUserId]);

      if (dbError) {
        console.warn("[ChatProvider] DB conversation lookup error:", dbError.message, dbError.details);
      }

      if (!dbError && dbConvos && dbConvos.length > 0) {
        const dbConvo = dbConvos[0];
        console.log("[ChatProvider] Found conversation in DB:", dbConvo.id);
        const existingConvo: Conversation = {
          id: dbConvo.id,
          participants: dbConvo.participants ?? [],
          participantNames: dbConvo.participant_names ?? {},
          lastMessage: dbConvo.last_message ?? undefined,
          lastMessageAt: dbConvo.last_message_at ?? undefined,
          unreadCount: dbConvo.unread_count ?? 0,
        };
        void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
        return existingConvo;
      }

      console.log("[ChatProvider] Creating new conversation:", currentUserName, "<->", friendName);
      const participantNames: Record<string, string> = {
        [currentUserId]: currentUserName,
        [friendUserId]: friendName,
      };

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          participants: [currentUserId, friendUserId],
          participant_names: participantNames,
          unread_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.warn("[ChatProvider] Create conversation error:", error.message, error.code, error.details);

        const { data: retryData } = await supabase
          .from("conversations")
          .select("*")
          .contains("participants", [currentUserId])
          .contains("participants", [friendUserId]);

        if (retryData && retryData.length > 0) {
          console.log("[ChatProvider] Found conversation on retry:", retryData[0].id);
          const retryConvo: Conversation = {
            id: retryData[0].id,
            participants: retryData[0].participants ?? [],
            participantNames: retryData[0].participant_names ?? {},
            lastMessage: retryData[0].last_message ?? undefined,
            lastMessageAt: retryData[0].last_message_at ?? undefined,
            unreadCount: retryData[0].unread_count ?? 0,
          };
          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
          return retryConvo;
        }

        Alert.alert("Chat Error", "Could not create conversation. Please try again.");
        throw new Error("Failed to create conversation: " + error.message);
      }

      const newConvo: Conversation = {
        id: data.id,
        participants: data.participants,
        participantNames: data.participant_names,
        unreadCount: 0,
      };

      console.log("[ChatProvider] Created conversation:", newConvo.id);
      void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
      return newConvo;
    },
    [conversations, queryClient]
  );

  const sendMessage = useCallback(
    async (conversationId: string, senderId: string, senderName: string, text: string, type: "text" | "location" = "text", locationData?: ChatMessage["locationData"]) => {
      if (conversationId.startsWith("conv_")) {
        console.warn("[ChatProvider] Cannot send message to local-only conversation:", conversationId);
        Alert.alert("Chat Error", "This conversation wasn't saved properly. Please go back and try again.");
        return null;
      }

      console.log("[ChatProvider] Sending message in", conversationId, "from", senderName);

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
        console.warn("[ChatProvider] Send message error:", error.message, error.code, error.details);
        Alert.alert("Message Error", "Failed to send message. Please check your connection and try again.");
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

      realtimeMessagesRef.current = [
        ...realtimeMessagesRef.current.filter((rm) => rm.id !== data.id),
        newMessage,
      ];

      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          last_message: text,
          last_message_at: newMessage.createdAt,
        })
        .eq("id", conversationId);

      if (updateError) {
        console.warn("[ChatProvider] Update conversation error:", updateError.message);
      }

      void queryClient.invalidateQueries({ queryKey: ["chat_messages"] });
      void queryClient.invalidateQueries({ queryKey: ["chat_conversations", senderId] });

      console.log("[ChatProvider] Message sent successfully:", data.id);
      return newMessage;
    },
    [queryClient]
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

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const getUnreadCount = useCallback(
    (conversationId: string) => unreadCounts[conversationId] ?? 0,
    [unreadCounts]
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
        return [...filtered, newLocation];
      });

      console.log("[ChatProvider] Started sharing location for", userName);
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
        prev.filter(
          (l) => !(l.userId === userId && l.conversationId === conversationId)
        )
      );
      console.log("[ChatProvider] Stopped sharing location");
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
      setActiveConversation,
      totalUnreadCount,
      getUnreadCount,
    }),
    [
      conversations, messages, liveLocations,
      getOrCreateConversation, sendMessage,
      getMessagesForConversation, getConversationsForUser,
      startSharingLocation, updateSharedLocation, stopSharingLocation,
      getLiveLocationsForConversation, isUserSharingLocation,
      setActiveConversation, totalUnreadCount, getUnreadCount,
    ]
  );
});
