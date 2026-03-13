import { useCallback, useEffect, useMemo, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/pushNotifications";
import { useAuth } from "@/providers/AuthProvider";
import { useLocation, getDistanceKm } from "@/providers/LocationProvider";
import {
  EventWithInvitations,
  EventRSVP,
} from "@/types";

const PROXIMITY_THRESHOLD_KM = 0.5;
const PROXIMITY_CHECK_INTERVAL = 15000;

async function fetchUserEvents(userId: string): Promise<EventWithInvitations[]> {
  console.log("[Events] Fetching events for user:", userId);

  const { data: hostedEvents, error: hostErr } = await supabase
    .from("dinner_events")
    .select("*")
    .eq("host_id", userId)
    .order("event_date", { ascending: true });

  if (hostErr) {
    console.warn("[Events] Host events error:", hostErr.message);
  }

  const { data: invitations, error: invErr } = await supabase
    .from("event_invitations")
    .select("*, dinner_events(*)")
    .eq("invited_user_id", userId);

  if (invErr) {
    console.warn("[Events] Invitations error:", invErr.message);
  }

  const eventMap = new Map<string, EventWithInvitations>();

  for (const row of hostedEvents ?? []) {
    eventMap.set(row.id, {
      id: row.id,
      hostId: row.host_id,
      hostName: row.host_name,
      title: row.title,
      description: row.description ?? "",
      restaurantName: row.restaurant_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.address ?? "",
      eventDate: row.event_date,
      createdAt: row.created_at,
      invitations: [],
    });
  }

  for (const inv of invitations ?? []) {
    const evt = inv.dinner_events;
    if (!evt) continue;
    if (!eventMap.has(evt.id)) {
      eventMap.set(evt.id, {
        id: evt.id,
        hostId: evt.host_id,
        hostName: evt.host_name,
        title: evt.title,
        description: evt.description ?? "",
        restaurantName: evt.restaurant_name,
        latitude: Number(evt.latitude),
        longitude: Number(evt.longitude),
        address: evt.address ?? "",
        eventDate: evt.event_date,
        createdAt: evt.created_at,
        invitations: [],
      });
    }
  }

  const allEventIds = Array.from(eventMap.keys());
  if (allEventIds.length > 0) {
    const { data: allInvitations } = await supabase
      .from("event_invitations")
      .select("*")
      .in("event_id", allEventIds);

    for (const inv of allInvitations ?? []) {
      const event = eventMap.get(inv.event_id);
      if (event) {
        event.invitations.push({
          id: inv.id,
          eventId: inv.event_id,
          invitedUserId: inv.invited_user_id,
          invitedUserName: inv.invited_user_name,
          status: inv.status as EventRSVP,
          respondedAt: inv.responded_at ?? undefined,
        });
      }
    }
  }

  const events = Array.from(eventMap.values());
  console.log("[Events] Loaded", events.length, "events");
  return events;
}

export const [EventProvider, useEvents] = createContextHook(() => {
  const { user } = useAuth();
  const { userLocation } = useLocation();
  const queryClient = useQueryClient();
  const notifiedProximityRef = useRef<Set<string>>(new Set());

  const eventsQuery = useQuery({
    queryKey: ["user_events", user?.id],
    queryFn: () => fetchUserEvents(user!.id),
    enabled: !!user?.id,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const invalidate = useCallback(() => {
    console.log("[Events] Invalidating");
    void queryClient.invalidateQueries({ queryKey: ["user_events", user?.id] });
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    console.log("[Events] Setting up realtime for:", user.id);

    const channel = supabase
      .channel(`events_rt_${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dinner_events" }, () => {
        console.log("[Events] RT: dinner_events changed");
        invalidate();
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "event_invitations" }, () => {
        console.log("[Events] RT: event_invitations changed");
        invalidate();
      })
      .subscribe((status: string) => {
        console.log("[Events] RT subscription:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, invalidate]);

  useEffect(() => {
    if (!user?.id || !userLocation) return;

    const checkProximity = () => {
      const now = new Date();
      for (const event of events) {
        if (event.hostId === user.id) continue;

        const myInvite = event.invitations.find(
          (inv) => inv.invitedUserId === user.id && inv.status === "accepted"
        );
        if (!myInvite) continue;

        const eventDate = new Date(event.eventDate);
        const hoursBefore = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursBefore > 2 || hoursBefore < -4) continue;

        const distance = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          event.latitude,
          event.longitude
        );

        const proximityKey = `${event.id}_${user.id}`;
        if (distance <= PROXIMITY_THRESHOLD_KM && !notifiedProximityRef.current.has(proximityKey)) {
          notifiedProximityRef.current.add(proximityKey);
          console.log("[Events] User is within 500m of event:", event.title);

          const acceptedUsers = event.invitations
            .filter((inv) => inv.status === "accepted" && inv.invitedUserId !== user.id)
            .map((inv) => inv.invitedUserId);

          const allToNotify = [...acceptedUsers, event.hostId];
          for (const targetId of allToNotify) {
            void sendPushToUser(
              targetId,
              `${user.name} is nearby!`,
              `${user.name} is less than 500m away from ${event.restaurantName}`,
              { type: "event_proximity", eventId: event.id }
            );
          }
        }
      }
    };

    checkProximity();
    const interval = setInterval(checkProximity, PROXIMITY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user, userLocation, events]);

  const createEventMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      description: string;
      restaurantName: string;
      latitude: number;
      longitude: number;
      address: string;
      eventDate: string;
      invitedFriendIds: { userId: string; name: string }[];
    }) => {
      if (!user) throw new Error("Not logged in");
      console.log("[Events] Creating event:", params.title);

      const { data: eventRow, error: eventErr } = await supabase
        .from("dinner_events")
        .insert({
          host_id: user.id,
          host_name: user.name,
          title: params.title,
          description: params.description,
          restaurant_name: params.restaurantName,
          latitude: params.latitude,
          longitude: params.longitude,
          address: params.address,
          event_date: params.eventDate,
        })
        .select()
        .single();

      if (eventErr || !eventRow) {
        console.warn("[Events] Create event error:", eventErr?.message);
        throw new Error(eventErr?.message ?? "Failed to create event");
      }

      console.log("[Events] Event created:", eventRow.id);

      if (params.invitedFriendIds.length > 0) {
        const invRows = params.invitedFriendIds.map((f) => ({
          event_id: eventRow.id,
          invited_user_id: f.userId,
          invited_user_name: f.name,
          status: "pending",
        }));

        const { error: invErr } = await supabase
          .from("event_invitations")
          .insert(invRows);

        if (invErr) {
          console.warn("[Events] Insert invitations error:", invErr.message);
        }

        for (const friend of params.invitedFriendIds) {
          void sendPushToUser(
            friend.userId,
            "Dinner Invitation!",
            `${user.name} invited you to "${params.title}" at ${params.restaurantName}`,
            { type: "event_invite", eventId: eventRow.id }
          );
        }
      }

      return eventRow.id as string;
    },
    onSuccess: () => invalidate(),
  });

  const respondToInviteMutation = useMutation({
    mutationFn: async (params: { invitationId: string; eventId: string; response: EventRSVP }) => {
      if (!user) throw new Error("Not logged in");
      console.log("[Events] Responding to invite:", params.invitationId, "=>", params.response);

      const { error } = await supabase
        .from("event_invitations")
        .update({
          status: params.response,
          responded_at: new Date().toISOString(),
        })
        .eq("id", params.invitationId);

      if (error) {
        console.warn("[Events] Respond error:", error.message);
        throw new Error(error.message);
      }

      const event = events.find((e) => e.id === params.eventId);
      if (event) {
        const responseText = params.response === "accepted" ? "I'm coming!" : "Sorry, I'm busy";
        void sendPushToUser(
          event.hostId,
          `RSVP: ${user.name}`,
          `${user.name} replied "${responseText}" to "${event.title}"`,
          { type: "event_rsvp", eventId: params.eventId, response: params.response }
        );
      }
    },
    onSuccess: () => invalidate(),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      console.log("[Events] Deleting event:", eventId);
      await supabase.from("event_invitations").delete().eq("event_id", eventId);
      const { error } = await supabase.from("dinner_events").delete().eq("id", eventId);
      if (error) {
        console.warn("[Events] Delete error:", error.message);
        throw new Error(error.message);
      }
    },
    onSuccess: () => invalidate(),
  });

  const myEvents = useMemo(
    () => events.filter((e) => e.hostId === user?.id),
    [events, user?.id]
  );

  const myInvitations = useMemo(
    () => events.filter((e) => e.hostId !== user?.id),
    [events, user?.id]
  );

  const pendingInvitations = useMemo(
    () =>
      myInvitations.filter((e) =>
        e.invitations.some(
          (inv) => inv.invitedUserId === user?.id && inv.status === "pending"
        )
      ),
    [myInvitations, user?.id]
  );

  return useMemo(
    () => ({
      events,
      myEvents,
      myInvitations,
      pendingInvitations,
      isLoading: eventsQuery.isLoading,
      createEvent: createEventMutation.mutateAsync,
      isCreating: createEventMutation.isPending,
      respondToInvite: respondToInviteMutation.mutateAsync,
      isResponding: respondToInviteMutation.isPending,
      deleteEvent: deleteEventMutation.mutateAsync,
      isDeleting: deleteEventMutation.isPending,
      refetch: eventsQuery.refetch,
    }),
    [
      events, myEvents, myInvitations, pendingInvitations,
      eventsQuery.isLoading,
      createEventMutation.mutateAsync, createEventMutation.isPending,
      respondToInviteMutation.mutateAsync, respondToInviteMutation.isPending,
      deleteEventMutation.mutateAsync, deleteEventMutation.isPending,
      eventsQuery.refetch,
    ]
  );
});
