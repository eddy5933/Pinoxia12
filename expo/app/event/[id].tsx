import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  ActionSheetIOS,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  CircleDot,
  Navigation,
  Trash2,
  UserCheck,
  UserX,
  HelpCircle,
  ExternalLink,
  Map,
  UserPlus,
  UserMinus,
  X,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useEvents } from "@/providers/EventProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useLocation, getDistanceKm, formatDistance } from "@/providers/LocationProvider";
import { EventRSVP } from "@/types";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { events, respondToInvite, isResponding, deleteEvent, isDeleting, addGuests, isAddingGuests, removeGuest, isRemovingGuest } = useEvents();
  const { friends } = useFriends();
  const [showGuestModal, setShowGuestModal] = useState<boolean>(false);
  const { userLocation } = useLocation();

  const event = useMemo(
    () => events.find((e) => e.id === id),
    [events, id]
  );

  const isHost = event?.hostId === user?.id;



  const myInvitation = useMemo(
    () => event?.invitations.find((inv) => inv.invitedUserId === user?.id),
    [event, user?.id]
  );

  const acceptedCount = useMemo(
    () => event?.invitations.filter((inv) => inv.status === "accepted").length ?? 0,
    [event]
  );

  const declinedCount = useMemo(
    () => event?.invitations.filter((inv) => inv.status === "declined").length ?? 0,
    [event]
  );

  const pendingCount = useMemo(
    () => event?.invitations.filter((inv) => inv.status === "pending").length ?? 0,
    [event]
  );

  const distanceText = useMemo(() => {
    if (!userLocation || !event) return null;
    const km = getDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      event.latitude,
      event.longitude
    );
    return formatDistance(km);
  }, [userLocation, event]);

  const canNavigate = useMemo(() => {
    if (!event || !myInvitation) return isHost;
    return myInvitation.status === "accepted" || isHost;
  }, [event, myInvitation, isHost]);

  const handleNavigate = useCallback(() => {
    if (!event) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { latitude, longitude, restaurantName } = event;
    const encodedName = encodeURIComponent(restaurantName);
    const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=&travelmode=driving`;
    const appleMapsUrl = `maps:0,0?q=${encodedName}&ll=${latitude},${longitude}&dirflg=d`;
    const googleMapsApp = `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
    const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;

    if (Platform.OS === "web") {
      void Linking.openURL(googleMapsWeb);
      return;
    }

    if (Platform.OS === "ios") {
      const checkApps = async () => {
        const options: string[] = ["Apple Maps"];
        const urls: string[] = [appleMapsUrl];
        try {
          if (await Linking.canOpenURL(googleMapsApp)) {
            options.push("Google Maps");
            urls.push(googleMapsApp);
          }
        } catch (e) { console.log("[Event] Google Maps check:", e); }
        try {
          if (await Linking.canOpenURL(wazeUrl)) {
            options.push("Waze");
            urls.push(wazeUrl);
          }
        } catch (e) { console.log("[Event] Waze check:", e); }
        options.push("Cancel");
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: options.length - 1, title: `Navigate to ${restaurantName}` },
          (idx) => {
            if (idx < urls.length) void Linking.openURL(urls[idx]);
          }
        );
      };
      void checkApps();
    } else {
      Alert.alert(`Navigate to ${restaurantName}`, "Choose navigation app", [
        { text: "Google Maps", onPress: () => void Linking.openURL(googleMapsWeb) },
        { text: "Waze", onPress: () => void Linking.openURL(wazeUrl) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [event]);

  const eventDateFormatted = useMemo(() => {
    if (!event) return "";
    const d = new Date(event.eventDate);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [event]);

  const eventTimeFormatted = useMemo(() => {
    if (!event) return "";
    const d = new Date(event.eventDate);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [event]);

  const handleRSVP = useCallback(
    async (response: EventRSVP) => {
      if (!myInvitation || !event) return;
      try {
        await respondToInvite({
          invitationId: myInvitation.id,
          eventId: event.id,
          response,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const msg =
          response === "accepted"
            ? "You're going! The host has been notified."
            : "You've declined. The host has been notified.";
        Alert.alert(response === "accepted" ? "Accepted!" : "Declined", msg);
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Failed to respond");
      }
    },
    [myInvitation, event, respondToInvite]
  );

  const availableFriends = useMemo(() => {
    if (!event) return [];
    const invitedIds = new Set(event.invitations.map((inv) => inv.invitedUserId));
    return friends.filter((f) => !invitedIds.has(f.userId) && f.userId !== event.hostId);
  }, [friends, event]);

  const handleAddGuest = useCallback(
    async (userId: string, name: string) => {
      if (!event) return;
      try {
        await addGuests({ eventId: event.id, guests: [{ userId, name }] });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Failed to add guest");
      }
    },
    [event, addGuests]
  );

  const handleRemoveGuest = useCallback(
    (invitationId: string, guestName: string) => {
      if (!event) return;
      Alert.alert(
        "Remove Guest",
        `Remove ${guestName} from the guest list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeGuest({ eventId: event.id, invitationId, guestName });
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch (err: any) {
                Alert.alert("Error", err?.message ?? "Failed to remove guest");
              }
            },
          },
        ]
      );
    },
    [event, removeGuest]
  );

  const handleDelete = useCallback(() => {
    if (!event) return;
    Alert.alert("Delete Event", "This will cancel the event and remove all invitations.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(event.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Failed to delete");
          }
        },
      },
    ]);
  }, [event, deleteEvent, router]);

  if (!event) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: "Event" }} />
        <Text style={styles.emptyText}>Event not found</Text>
      </View>
    );
  }

  const statusConfig: Record<EventRSVP, { icon: typeof CheckCircle; color: string; label: string }> = {
    accepted: { icon: UserCheck, color: "#4CAF50", label: "Going" },
    declined: { icon: UserX, color: "#FF6B6B", label: "Not Going" },
    pending: { icon: HelpCircle, color: "#FFB800", label: "Pending" },
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: event.title,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.white,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.eventHeader}>
          <View style={[styles.eventIconWrap, { backgroundColor: "rgba(69,183,209,0.12)" }]}>
            <Calendar size={28} color="#45B7D1" />
          </View>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.hostText}>
            Hosted by {isHost ? "you" : event.hostName}
          </Text>
        </View>

        {event.description ? (
          <View style={styles.card}>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "rgba(230,57,70,0.12)" }]}>
              <MapPin size={18} color={Colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Place</Text>
              <Text style={styles.detailValue}>{event.restaurantName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "rgba(69,183,209,0.12)" }]}>
              <Calendar size={18} color="#45B7D1" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{eventDateFormatted}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "rgba(255,184,0,0.12)" }]}>
              <Clock size={18} color="#FFB800" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{eventTimeFormatted}</Text>
            </View>
          </View>

          {distanceText && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: "rgba(76,175,80,0.12)" }]}>
                  <Navigation size={18} color={Colors.success} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Distance</Text>
                  <Text style={styles.detailValue}>{distanceText} away</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.showOnMapButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: '/(tabs)/map', params: { eventFocus: event.id } });
          }}
          activeOpacity={0.8}
          testID="show-on-map-button"
        >
          <View style={styles.showOnMapIconWrap}>
            <Map size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.showOnMapText}>Show on Map</Text>
            <Text style={styles.showOnMapSub}>View event location on map</Text>
          </View>
          <MapPin size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {canNavigate && (
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={handleNavigate}
            activeOpacity={0.8}
            testID="navigate-button"
          >
            <View style={styles.navigateIconWrap}>
              <Navigation size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navigateButtonText}>Navigate to {event.restaurantName}</Text>
              <Text style={styles.navigateButtonSub}>Open in maps app</Text>
            </View>
            <ExternalLink size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Guest List</Text>
            {isHost && (
              <TouchableOpacity
                style={styles.editGuestButton}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowGuestModal(true);
                }}
                activeOpacity={0.7}
                testID="edit-guest-list-button"
              >
                <Users size={14} color={Colors.primary} />
                <Text style={styles.editGuestButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rsvpSummary}>
            <View style={styles.rsvpBadge}>
              <CheckCircle size={14} color="#4CAF50" />
              <Text style={[styles.rsvpBadgeText, { color: "#4CAF50" }]}>
                {acceptedCount} going
              </Text>
            </View>
            <View style={styles.rsvpBadge}>
              <XCircle size={14} color="#FF6B6B" />
              <Text style={[styles.rsvpBadgeText, { color: "#FF6B6B" }]}>
                {declinedCount} declined
              </Text>
            </View>
            <View style={styles.rsvpBadge}>
              <CircleDot size={14} color="#FFB800" />
              <Text style={[styles.rsvpBadgeText, { color: "#FFB800" }]}>
                {pendingCount} pending
              </Text>
            </View>
          </View>

          {event.invitations.map((inv) => {
            const config = statusConfig[inv.status];
            const Icon = config.icon;
            return (
              <View key={inv.id} style={styles.guestRow}>
                <View style={styles.guestAvatar}>
                  <Text style={styles.guestAvatarText}>
                    {inv.invitedUserName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.guestName} numberOfLines={1}>
                  {inv.invitedUserName}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: config.color + "18" }]}>
                  <Icon size={14} color={config.color} />
                  <Text style={[styles.statusText, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>
                {isHost && (
                  <TouchableOpacity
                    style={styles.removeGuestInline}
                    onPress={() => handleRemoveGuest(inv.id, inv.invitedUserName)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <UserMinus size={14} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {!isHost && myInvitation && myInvitation.status === "pending" && (
          <View style={styles.rsvpSection}>
            <Text style={styles.rsvpTitle}>You're Invited!</Text>
            <Text style={styles.rsvpSubtitle}>
              Will you be joining this event?
            </Text>
            <View style={styles.rsvpButtons}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => void handleRSVP("accepted")}
                disabled={isResponding}
                activeOpacity={0.8}
                testID="accept-invite"
              >
                {isResponding ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <CheckCircle size={20} color={Colors.white} />
                    <Text style={styles.acceptButtonText}>I'm Coming!</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => void handleRSVP("declined")}
                disabled={isResponding}
                activeOpacity={0.8}
                testID="decline-invite"
              >
                <XCircle size={20} color="#FF6B6B" />
                <Text style={styles.declineButtonText}>Sorry, I'm Busy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isHost && myInvitation && myInvitation.status !== "pending" && (
          <View style={styles.respondedCard}>
            <Text style={styles.respondedText}>
              {myInvitation.status === "accepted"
                ? "You're attending this event! 🎉"
                : "You've declined this invitation."}
            </Text>
            {myInvitation.status === "accepted" && (
              <Text style={styles.respondedSubtext}>
                Your live location will be shared with attendees when you're nearby.
              </Text>
            )}
          </View>
        )}

        {isHost && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
            activeOpacity={0.7}
            testID="delete-event-button"
          >
            {isDeleting ? (
              <ActivityIndicator color="#FF3B30" size="small" />
            ) : (
              <>
                <Trash2 size={18} color="#FF3B30" />
                <Text style={styles.deleteText}>Cancel Event</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={showGuestModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGuestModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Guest List</Text>
            <TouchableOpacity
              onPress={() => setShowGuestModal(false)}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSectionTitle}>Current Guests</Text>
          {event.invitations.length === 0 ? (
            <View style={styles.emptyGuests}>
              <Text style={styles.emptyGuestsText}>No guests added yet</Text>
            </View>
          ) : (
            <FlatList
              data={event.invitations}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              renderItem={({ item: inv }) => {
                const config = statusConfig[inv.status];
                const StatusIcon = config.icon;
                return (
                  <View style={styles.modalGuestRow}>
                    <View style={styles.modalGuestAvatar}>
                      <Text style={styles.modalGuestAvatarText}>
                        {inv.invitedUserName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalGuestInfo}>
                      <Text style={styles.modalGuestName} numberOfLines={1}>
                        {inv.invitedUserName}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <StatusIcon size={12} color={config.color} />
                        <Text style={[styles.modalGuestStatus, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.modalRemoveButton}
                      onPress={() => handleRemoveGuest(inv.id, inv.invitedUserName)}
                      disabled={isRemovingGuest}
                      activeOpacity={0.7}
                    >
                      {isRemovingGuest ? (
                        <ActivityIndicator size="small" color="#FF6B6B" />
                      ) : (
                        <>
                          <UserMinus size={14} color="#FF6B6B" />
                          <Text style={styles.modalRemoveText}>Remove</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}

          <Text style={[styles.modalSectionTitle, { marginTop: 20 }]}>Add Friends</Text>
          <FlatList
            data={availableFriends}
            keyExtractor={(item) => item.userId}
            style={styles.modalList}
            ListEmptyComponent={
              <View style={styles.emptyGuests}>
                <Text style={styles.emptyGuestsText}>No more friends to add</Text>
              </View>
            }
            renderItem={({ item: friend }) => (
              <View style={styles.modalGuestRow}>
                <View style={[styles.modalGuestAvatar, { backgroundColor: "rgba(69,183,209,0.15)" }]}>
                  <Text style={[styles.modalGuestAvatarText, { color: "#45B7D1" }]}>
                    {friend.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.modalGuestInfo}>
                  <Text style={styles.modalGuestName} numberOfLines={1}>
                    {friend.name}
                  </Text>
                  <Text style={styles.modalGuestEmail} numberOfLines={1}>
                    {friend.email}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalAddButton}
                  onPress={() => handleAddGuest(friend.userId, friend.name)}
                  disabled={isAddingGuests}
                  activeOpacity={0.7}
                >
                  {isAddingGuests ? (
                    <ActivityIndicator size="small" color={Colors.success} />
                  ) : (
                    <>
                      <UserPlus size={14} color={Colors.success} />
                      <Text style={styles.modalAddText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  eventHeader: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  eventIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(230,57,70,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  eventTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
    textAlign: "center",
    marginBottom: 6,
  },
  hostText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "500" as const,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: "600" as const,
  },
  detailSubvalue: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  editGuestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(230,57,70,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.25)",
  },
  editGuestButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  removeGuestInline: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  rsvpSummary: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  rsvpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rsvpBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  guestAvatarText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  guestName: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    fontWeight: "500" as const,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  rsvpSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "rgba(230,57,70,0.06)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
  },
  rsvpTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 6,
  },
  rsvpSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  rsvpButtons: {
    width: "100%",
    gap: 10,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,107,0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.3)",
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FF6B6B",
  },
  respondedCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  respondedText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.white,
    textAlign: "center",
  },
  respondedSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,48,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.25)",
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FF3B30",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalGuestRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalGuestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  modalGuestAvatarText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  modalGuestInfo: {
    flex: 1,
    gap: 2,
  },
  modalGuestName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  modalGuestStatus: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  modalGuestEmail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalRemoveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,107,107,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.25)",
  },
  modalRemoveText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#FF6B6B",
  },
  modalAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(76,175,80,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.25)",
  },
  modalAddText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  emptyGuests: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyGuestsText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  showOnMapButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    gap: 14,
  },
  showOnMapIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  showOnMapText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 2,
  },
  showOnMapSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#1B8A4A",
    gap: 14,
  },
  navigateIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 2,
  },
  navigateButtonSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
});
