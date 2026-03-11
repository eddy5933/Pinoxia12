import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery } from "@tanstack/react-query";
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConversationRef = useRef<string | null>(null);

  const loadQuery = useQuery({
    queryKey: ["chat_load"],
    queryFn: async () => {
      console.log("[ChatProvider] Loading data from Supabase...");
      const [convosRes, messagesRes] = await Promise.all([
        supabase.from("conversations").select("*"),
        supabase.from("messages").select("*").order("created_at", { ascending: true }),
      ]);

      const loadedConversations: Conversation[] = (convosRes.data ?? []).map((c: any) => ({
        id: c.id,
        participants: c.participants ?? [],
        participantNames: c.participant_names ?? {},
        lastMessage: c.last_message ?? undefined,
        lastMessageAt: c.last_message_at ?? undefined,
        unreadCount: c.unread_count ?? 0,
      }));

      const loadedMessages: ChatMessage[] = (messagesRes.data ?? []).map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        text: m.text,
        type: m.type ?? "text",
        locationData: m.location_data ?? undefined,
        createdAt: m.created_at,
      }));

      console.log("[ChatProvider] Loaded", loadedConversations.length, "conversations,", loadedMessages.length, "messages");
      return { conversations: loadedConversations, messages: loadedMessages };
    },
    staleTime: 5000,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setConversations(loadQuery.data.conversations);
      setMessages(loadQuery.data.messages);
    }
  }, [loadQuery.data]);

  useEffect(() => {
    console.log("[ChatProvider] Setting up realtime subscription for messages");
    const channel = supabase
      .channel("messages_realtime")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          console.log("[ChatProvider] Realtime new message:", payload.new?.id);
          const m = payload.new;
          if (!m) return;

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

          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversationId
                ? { ...c, lastMessage: newMsg.text, lastMessageAt: newMsg.createdAt }
                : c
            )
          );

          if (
            user &&
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

          const newConvo: Conversation = {
            id: c.id,
            participants: c.participants ?? [],
            participantNames: c.participant_names ?? {},
            lastMessage: c.last_message ?? undefined,
            lastMessageAt: c.last_message_at ?? undefined,
            unreadCount: c.unread_count ?? 0,
          };

          setConversations((prev) => {
            if (prev.some((conv) => conv.id === newConvo.id)) return prev;
            return [newConvo, ...prev];
          });
        }
      )
      .subscribe((status: string) => {
        console.log("[ChatProvider] Realtime subscription status:", status);
      });

    return () => {
      console.log("[ChatProvider] Cleaning up realtime subscription");
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const getOrCreateConversation = useCallback(
    async (currentUserId: string, currentUserName: string, friendUserId: string, friendName: string) => {
      const existing = conversations.find(
        (c) => c.participants.includes(currentUserId) && c.participants.includes(friendUserId)
      );
      if (existing) return existing;

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
        console.warn("[ChatProvider] Create conversation error:", error.message);
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
      setConversations((prev) => [newConvo, ...prev]);
      console.log("[ChatProvider] Created conversation between", currentUserName, "and", friendName);
      return newConvo;
    },
    [conversations]
  );

  const sendMessage = useCallback(
    async (conversationId: string, senderId: string, senderName: string, text: string, type: "text" | "location" = "text", locationData?: ChatMessage["locationData"]) => {
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
        console.warn("[ChatProvider] Send message error:", error.message);
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

      setMessages((prev) => [...prev, newMessage]);

      await supabase
        .from("conversations")
        .update({
          last_message: text,
          last_message_at: newMessage.createdAt,
        })
        .eq("id", conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: text, lastMessageAt: newMessage.createdAt }
            : c
        )
      );

      console.log("[ChatProvider] Sent message in", conversationId);
      return newMessage;
    },
    []
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
