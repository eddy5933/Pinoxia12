import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatMessage, Conversation } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const conversationIdsRef = useRef<Set<string>>(new Set());

  const loadQuery = useQuery({
    queryKey: ["chat_load", user?.id],
    queryFn: async () => {
      if (!user) return { conversations: [], messages: [] };
      console.log("[ChatProvider] Loading data from Supabase for user:", user.id);

      const convosRes = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [user.id]);

      if (convosRes.error) {
        console.error("[ChatProvider] Conversations query error:", convosRes.error.message, convosRes.error.details);
      }

      const loadedConversations: Conversation[] = (convosRes.data ?? []).map((c: any) => ({
        id: c.id,
        participants: c.participants ?? [],
        participantNames: c.participant_names ?? {},
        lastMessage: c.last_message ?? undefined,
        lastMessageAt: c.last_message_at ?? undefined,
        unreadCount: c.unread_count ?? 0,
      }));

      const convoIds = loadedConversations.map((c) => c.id);
      let loadedMessages: ChatMessage[] = [];

      if (convoIds.length > 0) {
        const messagesRes = await supabase
          .from("messages")
          .select("*")
          .in("conversation_id", convoIds)
          .order("created_at", { ascending: true });

        if (messagesRes.error) {
          console.error("[ChatProvider] Messages query error:", messagesRes.error.message, messagesRes.error.details);
        }

        loadedMessages = (messagesRes.data ?? []).map((m: any) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          text: m.text,
          type: m.type ?? "text",
          locationData: m.location_data ?? undefined,
          createdAt: m.created_at,
        }));
      }

      console.log("[ChatProvider] Loaded", loadedConversations.length, "conversations,", loadedMessages.length, "messages");
      return { conversations: loadedConversations, messages: loadedMessages };
    },
    enabled: !!user?.id,
    staleTime: 2000,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setConversations(loadQuery.data.conversations);
      setMessages(loadQuery.data.messages);
      const msgIds = new Set<string>();
      loadQuery.data.messages.forEach((m) => msgIds.add(m.id));
      knownMessageIdsRef.current = msgIds;
      const convoIds = new Set<string>();
      loadQuery.data.conversations.forEach((c) => convoIds.add(c.id));
      conversationIdsRef.current = convoIds;
    }
  }, [loadQuery.data]);

  useEffect(() => {
    if (!user?.id) return;
    console.log("[ChatProvider] Setting up realtime subscription for messages, user:", user.id);
    const channelName = `chat_realtime_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          console.log("[ChatProvider] Realtime new message:", payload.new?.id, "sender:", payload.new?.sender_name);
          const m = payload.new;
          if (!m) return;

          if (knownMessageIdsRef.current.has(m.id)) {
            console.log("[ChatProvider] Skipping known message:", m.id);
            return;
          }
          knownMessageIdsRef.current.add(m.id);

          if (!conversationIdsRef.current.has(m.conversation_id)) {
            console.log("[ChatProvider] Message for unknown conversation, triggering refetch");
            void queryClient.invalidateQueries({ queryKey: ["chat_load", user.id] });
            return;
          }

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

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          setConversations((prev) => {
            const hasConvo = prev.some((c) => c.id === newMsg.conversationId);
            if (!hasConvo) {
              console.log("[ChatProvider] Conversation not in local state, refetching");
              void queryClient.invalidateQueries({ queryKey: ["chat_load", user.id] });
              return prev;
            }
            return prev.map((c) =>
              c.id === newMsg.conversationId
                ? { ...c, lastMessage: newMsg.text, lastMessageAt: newMsg.createdAt }
                : c
            );
          });

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
          console.log("[ChatProvider] Realtime new conversation:", payload.new?.id);
          const c = payload.new;
          if (!c) return;

          const participants: string[] = c.participants ?? [];
          if (!participants.includes(user.id)) return;

          const newConvo: Conversation = {
            id: c.id,
            participants,
            participantNames: c.participant_names ?? {},
            lastMessage: c.last_message ?? undefined,
            lastMessageAt: c.last_message_at ?? undefined,
            unreadCount: c.unread_count ?? 0,
          };

          conversationIdsRef.current.add(c.id);
          setConversations((prev) => {
            if (prev.some((conv) => conv.id === newConvo.id)) return prev;
            return [newConvo, ...prev];
          });
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload: any) => {
          const c = payload.new;
          if (!c) return;
          const participants: string[] = c.participants ?? [];
          if (!participants.includes(user.id)) return;

          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === c.id
                ? {
                    ...conv,
                    lastMessage: c.last_message ?? conv.lastMessage,
                    lastMessageAt: c.last_message_at ?? conv.lastMessageAt,
                  }
                : conv
            )
          );
        }
      )
      .subscribe((status: string) => {
        console.log("[ChatProvider] Realtime subscription status:", status);
        if (status === "CHANNEL_ERROR") {
          console.warn("[ChatProvider] Realtime channel error, relying on polling");
        }
      });

    return () => {
      console.log("[ChatProvider] Cleaning up realtime subscription");
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getOrCreateConversation = useCallback(
    async (currentUserId: string, currentUserName: string, friendUserId: string, friendName: string) => {
      const existing = conversations.find(
        (c) => c.participants.includes(currentUserId) && c.participants.includes(friendUserId)
      );
      if (existing) return existing;

      console.log("[ChatProvider] No local conversation found, checking Supabase DB...");
      const { data: existingDb } = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [currentUserId, friendUserId]);

      if (existingDb && existingDb.length > 0) {
        const dbConvo = existingDb[0];
        const convo: Conversation = {
          id: dbConvo.id,
          participants: dbConvo.participants ?? [],
          participantNames: dbConvo.participant_names ?? {},
          lastMessage: dbConvo.last_message ?? undefined,
          lastMessageAt: dbConvo.last_message_at ?? undefined,
          unreadCount: dbConvo.unread_count ?? 0,
        };
        conversationIdsRef.current.add(convo.id);
        setConversations((prev) => {
          if (prev.some((c) => c.id === convo.id)) return prev;
          return [convo, ...prev];
        });
        console.log("[ChatProvider] Found existing conversation in DB:", convo.id);
        return convo;
      }

      console.log("[ChatProvider] Creating new conversation between", currentUserName, "and", friendName);
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
        console.error("[ChatProvider] Create conversation error:", error.message, error.details, error.hint);
        const fallback: Conversation = {
          id: `conv_${Date.now()}`,
          participants: [currentUserId, friendUserId],
          participantNames,
          unreadCount: 0,
        };
        setConversations((prev) => [fallback, ...prev]);
        return fallback;
      }

      const newConvo: Conversation = {
        id: data.id,
        participants: data.participants,
        participantNames: data.participant_names,
        unreadCount: 0,
      };
      conversationIdsRef.current.add(data.id);
      setConversations((prev) => [newConvo, ...prev]);
      console.log("[ChatProvider] Created conversation:", data.id);
      return newConvo;
    },
    [conversations]
  );

  const sendMessage = useCallback(
    async (conversationId: string, senderId: string, senderName: string, text: string, type: "text" | "location" = "text", locationData?: ChatMessage["locationData"]) => {
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
        console.error("[ChatProvider] Send message error:", error.message, "details:", error.details, "hint:", error.hint);
        const fallbackMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          conversationId,
          senderId,
          senderName,
          text,
          type,
          locationData,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        return fallbackMsg;
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

      knownMessageIdsRef.current.add(data.id);
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) return prev;
        return [...prev, newMessage];
      });

      const updateRes = await supabase
        .from("conversations")
        .update({
          last_message: text,
          last_message_at: newMessage.createdAt,
        })
        .eq("id", conversationId);

      if (updateRes.error) {
        console.error("[ChatProvider] Update conversation error:", updateRes.error.message);
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: text, lastMessageAt: newMessage.createdAt }
            : c
        )
      );

      console.log("[ChatProvider] Sent message successfully, id:", data.id);
      return newMessage;
    },
    []
  );

  const refetchChats = useCallback(() => {
    console.log("[ChatProvider] Manual refetch triggered");
    void queryClient.invalidateQueries({ queryKey: ["chat_load", user?.id] });
  }, [queryClient, user?.id]);

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
      refetchChats,
    }),
    [
      conversations, messages, liveLocations,
      getOrCreateConversation, sendMessage,
      getMessagesForConversation, getConversationsForUser,
      startSharingLocation, updateSharedLocation, stopSharingLocation,
      getLiveLocationsForConversation, isUserSharingLocation,
      setActiveConversation, totalUnreadCount, getUnreadCount,
      refetchChats,
    ]
  );
});
