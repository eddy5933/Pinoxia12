import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  LogOut,
  Store,
  ChevronRight,
  RefreshCw,
  Plus,
  Mail,
  Eye,
  Trash2,
  UtensilsCrossed,
  CalendarPlus,
  Clock,
  CheckCircle,
  XCircle,
  CircleDot,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import PinoxiaLogo from "@/components/PinoxiaLogo";
import { useAuth } from "@/providers/AuthProvider";
import { useOnlineStatus } from "@/providers/OnlineStatusProvider";
import { useEvents } from "@/providers/EventProvider";
import { OnlineVisibility } from "@/types";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading, logout, deleteAccount, toggleRole } = useAuth();
  const { visibility, openStatusPicker } = useOnlineStatus();
  const { myEvents, pendingInvitations, myInvitations } = useEvents();

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...myEvents, ...myInvitations]
      .filter((e) => new Date(e.eventDate) >= now)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .slice(0, 5);
  }, [myEvents, myInvitations]);

  const formatEventDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfEventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfEventDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  const formatEventTime = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }, []);

  const visibilityLabel: Record<OnlineVisibility, string> = {
    hidden: "Invisible",
    friends_only: "Friends Only",
    everyone: "Everyone",
  };

  const visibilityColor: Record<OnlineVisibility, string> = {
    hidden: "#FF6B6B",
    friends_only: "#4ECDC4",
    everyone: "#45B7D1",
  };

  const handleLogout = useCallback(async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data, including businesses and reviews, will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Type confirms this will permanently delete your account.",
              [
                { text: "Go Back", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAccount();
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  const handleToggleRole = useCallback(async () => {
    await toggleRole();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [toggleRole]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <PinoxiaLogo size="small" />
        </View>
        <View style={styles.centered}>
          <View style={styles.avatarPlaceholder}>
            <User size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.guestTitle}>Welcome to Pinoxia</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to leave reviews, register your business, and more
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
            testID="sign-in-button"
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwner = user.role === "owner";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <PinoxiaLogo size="small" />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <View style={styles.emailRow}>
              <Mail size={13} color={Colors.textMuted} />
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
              <Text style={[styles.roleBadgeText, isOwner && styles.roleBadgeTextOwner]}>
                {isOwner ? "Business Owner" : "Customer"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openStatusPicker();
            }}
            activeOpacity={0.7}
            testID="online-status"
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: `${visibilityColor[visibility]}18` }]}>
                <Eye size={18} color={visibilityColor[visibility]} />
              </View>
              <View>
                <Text style={styles.menuItemText}>Online Status</Text>
                <Text style={[styles.menuItemSubtext, { color: visibilityColor[visibility] }]}>
                  {visibilityLabel[visibility]}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => void handleToggleRole()}
            activeOpacity={0.7}
            testID="toggle-role"
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(230,57,70,0.12)" }]}>
                <RefreshCw size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.menuItemText}>Switch Role</Text>
                <Text style={styles.menuItemSubtext}>
                  Currently: {isOwner ? "Owner" : "Customer"}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {isOwner && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/my-restaurants")}
                activeOpacity={0.7}
                testID="my-restaurants"
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(255,184,0,0.12)" }]}>
                    <Store size={18} color={Colors.star} />
                  </View>
                  <Text style={styles.menuItemText}>My Businesses</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/add-restaurant")}
                activeOpacity={0.7}
                testID="add-restaurant"
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(76,175,80,0.12)" }]}>
                    <Plus size={18} color={Colors.success} />
                  </View>
                  <Text style={styles.menuItemText}>Register Business</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Events</Text>

          <TouchableOpacity
            style={styles.createEventBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/create-event");
            }}
            activeOpacity={0.8}
            testID="create-event"
          >
            <View style={styles.createEventIconWrap}>
              <CalendarPlus size={22} color="#fff" />
            </View>
            <View style={styles.createEventTextWrap}>
              <Text style={styles.createEventTitle}>Create New Event</Text>
              <Text style={styles.createEventSubtitle}>Plan an event</Text>
            </View>
            <ChevronRight size={18} color={Colors.primary} />
          </TouchableOpacity>

          {pendingInvitations.length > 0 && (
            <TouchableOpacity
              style={styles.pendingBanner}
              onPress={() => {
                if (pendingInvitations[0]) {
                  router.push(`/event/${pendingInvitations[0].id}`);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>
                {pendingInvitations.length} pending invitation{pendingInvitations.length > 1 ? "s" : ""}
              </Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {upcomingEvents.length === 0 ? (
            <View style={styles.emptyEvents}>
              <UtensilsCrossed size={24} color={Colors.textMuted} />
              <Text style={styles.emptyEventsText}>No upcoming events</Text>
              <Text style={styles.emptyEventsSubtext}>
                Plan an event
              </Text>
            </View>
          ) : (
            upcomingEvents.map((event) => {
              const isHost = event.hostId === user.id;
              const accepted = event.invitations.filter((i) => i.status === "accepted").length;
              const myInvite = event.invitations.find((i) => i.invitedUserId === user.id);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => router.push(`/event/${event.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventCardLeft}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDateDay}>
                        {new Date(event.eventDate).getDate()}
                      </Text>
                      <Text style={styles.eventDateMonth}>
                        {new Date(event.eventDate).toLocaleDateString("en-US", { month: "short" })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventCardContent}>
                    <Text style={styles.eventCardTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <View style={styles.eventCardMeta}>
                      <UtensilsCrossed size={12} color={Colors.textMuted} />
                      <Text style={styles.eventCardMetaText} numberOfLines={1}>
                        {event.restaurantName}
                      </Text>
                    </View>
                    <View style={styles.eventCardMeta}>
                      <Clock size={12} color={Colors.textMuted} />
                      <Text style={styles.eventCardMetaText}>
                        {formatEventDate(event.eventDate)} at {formatEventTime(event.eventDate)}
                      </Text>
                    </View>
                    <View style={styles.eventCardFooter}>
                      {isHost ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>Host</Text>
                        </View>
                      ) : myInvite ? (
                        <View
                          style={[
                            styles.rsvpMini,
                            {
                              backgroundColor:
                                myInvite.status === "accepted"
                                  ? "rgba(76,175,80,0.12)"
                                  : myInvite.status === "declined"
                                  ? "rgba(255,107,107,0.12)"
                                  : "rgba(255,184,0,0.12)",
                            },
                          ]}
                        >
                          {myInvite.status === "accepted" ? (
                            <CheckCircle size={12} color="#4CAF50" />
                          ) : myInvite.status === "declined" ? (
                            <XCircle size={12} color="#FF6B6B" />
                          ) : (
                            <CircleDot size={12} color="#FFB800" />
                          )}
                          <Text
                            style={[
                              styles.rsvpMiniText,
                              {
                                color:
                                  myInvite.status === "accepted"
                                    ? "#4CAF50"
                                    : myInvite.status === "declined"
                                    ? "#FF6B6B"
                                    : "#FFB800",
                              },
                            ]}
                          >
                            {myInvite.status === "accepted"
                              ? "Going"
                              : myInvite.status === "declined"
                              ? "Declined"
                              : "Pending"}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.attendeeCount}>
                        {accepted} attending
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => void handleLogout()}
          activeOpacity={0.7}
          testID="logout-button"
        >
          <LogOut size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          testID="delete-account-button"
        >
          <Trash2 size={18} color="#FF3B30" />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHighlight,
  },
  roleBadgeOwner: {
    backgroundColor: "rgba(230,57,70,0.15)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  roleBadgeTextOwner: {
    color: Colors.primary,
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  menuItemSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.3)",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  deleteButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
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
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  createEventBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    backgroundColor: "rgba(230,57,70,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(230,57,70,0.25)",
    borderStyle: "dashed" as const,
    marginBottom: 12,
  },
  createEventIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  createEventTextWrap: {
    flex: 1,
  },
  createEventTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  createEventSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pendingBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(230,57,70,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  pendingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  emptyEvents: {
    alignItems: "center" as const,
    paddingVertical: 24,
    gap: 8,
  },
  emptyEventsText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  emptyEventsSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  eventCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  eventCardLeft: {
    alignItems: "center" as const,
  },
  eventDateBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(230,57,70,0.12)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  eventDateDay: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.primary,
    lineHeight: 22,
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.primary,
    textTransform: "uppercase" as const,
  },
  eventCardContent: {
    flex: 1,
    gap: 3,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  eventCardMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  eventCardMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  eventCardFooter: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 4,
  },
  hostBadge: {
    backgroundColor: "rgba(230,57,70,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  rsvpMini: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rsvpMiniText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  attendeeCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
