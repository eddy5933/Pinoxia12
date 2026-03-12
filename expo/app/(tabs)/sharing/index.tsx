import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Radio,
  Wifi,
  MapPin,
  Eye,
  Send,
  Users,
  Heart,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLocation, formatDistance, getDistanceKm } from "@/providers/LocationProvider";
import { useFriends } from "@/providers/FriendsProvider";
import type { FriendLocation } from "@/providers/LocationProvider";
import type { Friend } from "@/types";

type Tab = "viewing" | "sharing";

function SharingUserCard({
  friend,
  distance,
  type,
}: {
  friend: FriendLocation;
  distance: string | null;
  type: "close_friend" | "family";
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const initials = friend.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const accentColor = type === "close_friend" ? "#3B82F6" : "#A855F7";
  const bgTint = type === "close_friend" ? "rgba(59,130,246,0.08)" : "rgba(168,85,247,0.08)";

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(friend.updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [friend.updatedAt]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[cardStyles.card, { backgroundColor: bgTint, borderColor: accentColor + "30" }]}
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        testID={`sharing-card-${friend.userId}`}
      >
        <View style={[cardStyles.avatarRing, { borderColor: accentColor }]}>
          {friend.avatar ? (
            <Image source={{ uri: friend.avatar }} style={cardStyles.avatar} contentFit="cover" />
          ) : (
            <View style={[cardStyles.avatarFallback, { backgroundColor: accentColor + "40" }]}>
              <Text style={cardStyles.initials}>{initials}</Text>
            </View>
          )}
          <View style={[cardStyles.onlineDot, { borderColor: bgTint }]} />
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{friend.name}</Text>
          <View style={cardStyles.metaRow}>
            <View style={[cardStyles.badge, { backgroundColor: accentColor + "20" }]}>
              {type === "close_friend" ? (
                <Users size={9} color={accentColor} />
              ) : (
                <Heart size={9} color={accentColor} />
              )}
              <Text style={[cardStyles.badgeText, { color: accentColor }]}>
                {type === "close_friend" ? "Close Friend" : "Family"}
              </Text>
            </View>
          </View>
          {friend.placeName && (
            <View style={cardStyles.locationRow}>
              <MapPin size={10} color={Colors.textMuted} />
              <Text style={cardStyles.locationText} numberOfLines={1}>{friend.placeName}</Text>
            </View>
          )}
        </View>
        <View style={cardStyles.rightCol}>
          {distance && (
            <Text style={[cardStyles.distance, { color: accentColor }]}>{distance}</Text>
          )}
          <Text style={cardStyles.timeAgo}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SharingToCard({
  friend,
  type,
  isActive,
}: {
  friend: Friend;
  type: "close_friend" | "family";
  isActive: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const initials = friend.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const accentColor = type === "close_friend" ? "#3B82F6" : "#A855F7";
  const bgTint = type === "close_friend" ? "rgba(59,130,246,0.06)" : "rgba(168,85,247,0.06)";

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[sharingToStyles.card, { backgroundColor: bgTint, borderColor: accentColor + "25" }]}
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        testID={`sharing-to-card-${friend.userId}`}
      >
        <View style={[sharingToStyles.avatarRing, { borderColor: accentColor }]}>
          {friend.avatar ? (
            <Image source={{ uri: friend.avatar }} style={sharingToStyles.avatar} contentFit="cover" />
          ) : (
            <View style={[sharingToStyles.avatarFallback, { backgroundColor: accentColor + "40" }]}>
              <Text style={sharingToStyles.initials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={sharingToStyles.info}>
          <Text style={sharingToStyles.name} numberOfLines={1}>{friend.name}</Text>
          <View style={sharingToStyles.metaRow}>
            <View style={[sharingToStyles.badge, { backgroundColor: accentColor + "20" }]}>
              {type === "close_friend" ? (
                <Users size={9} color={accentColor} />
              ) : (
                <Heart size={9} color={accentColor} />
              )}
              <Text style={[sharingToStyles.badgeText, { color: accentColor }]}>
                {type === "close_friend" ? "Close Friend" : "Family"}
              </Text>
            </View>
            <View style={[
              sharingToStyles.statusDot,
              { backgroundColor: isActive ? Colors.success : Colors.textMuted },
            ]} />
            <Text style={[
              sharingToStyles.statusText,
              { color: isActive ? Colors.success : Colors.textMuted },
            ]}>
              {isActive ? "Sharing active" : "Sharing paused"}
            </Text>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        {tab === "viewing" ? (
          <Eye size={32} color={Colors.textMuted} />
        ) : (
          <Send size={32} color={Colors.textMuted} />
        )}
      </View>
      <Text style={emptyStyles.title}>
        {tab === "viewing" ? "No one sharing with you" : "Not sharing with anyone"}
      </Text>
      <Text style={emptyStyles.subtitle}>
        {tab === "viewing"
          ? "When close friends or family share their location, they'll appear here"
          : "Toggle sharing on the Map tab to share your location with close friends and family"}
      </Text>
    </View>
  );
}

export default function SharingScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("viewing");
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const { friendLocations, familyLocations, userLocation, closeFriendSharingEnabled, familySharingEnabled } = useLocation();
  const { closeFriends, familyMembers } = useFriends();

  const handleTabSwitch = useCallback((tab: Tab) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: tab === "viewing" ? 0 : 1,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
    console.log("[SharingScreen] Switched to tab:", tab);
  }, [tabIndicatorAnim]);

  const viewingData = useMemo(() => {
    const items: { friend: FriendLocation; type: "close_friend" | "family"; distance: string | null }[] = [];
    for (const fl of friendLocations) {
      const dist = userLocation
        ? formatDistance(getDistanceKm(userLocation.latitude, userLocation.longitude, fl.latitude, fl.longitude))
        : null;
      items.push({ friend: fl, type: "close_friend", distance: dist });
    }
    for (const fl of familyLocations) {
      items.push({
        friend: fl,
        type: "family",
        distance: userLocation
          ? formatDistance(getDistanceKm(userLocation.latitude, userLocation.longitude, fl.latitude, fl.longitude))
          : null,
      });
    }
    return items;
  }, [friendLocations, familyLocations, userLocation]);

  const sharingToData = useMemo(() => {
    const items: { friend: Friend; type: "close_friend" | "family"; isActive: boolean }[] = [];
    for (const f of closeFriends) {
      items.push({ friend: f, type: "close_friend", isActive: closeFriendSharingEnabled });
    }
    for (const f of familyMembers) {
      items.push({ friend: f, type: "family", isActive: familySharingEnabled });
    }
    return items;
  }, [closeFriends, familyMembers, closeFriendSharingEnabled, familySharingEnabled]);

  const totalViewing = viewingData.length;
  const totalSharingTo = sharingToData.length;

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Radio size={16} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Location Sharing</Text>
            <Text style={styles.headerSubtitle}>
              {totalViewing} sharing with you · {totalSharingTo} you share to
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                transform: [{
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }],
                left: activeTab === "viewing" ? "1%" : "50%",
                width: "48%",
              },
            ]}
          />
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabSwitch("viewing")}
            activeOpacity={0.7}
            testID="tab-viewing"
          >
            <Eye size={14} color={activeTab === "viewing" ? Colors.white : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === "viewing" && styles.tabTextActive]}>
              Sharing With Me
            </Text>
            {totalViewing > 0 && (
              <View style={[styles.tabCount, activeTab === "viewing" && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === "viewing" && styles.tabCountTextActive]}>
                  {totalViewing}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabSwitch("sharing")}
            activeOpacity={0.7}
            testID="tab-sharing"
          >
            <Send size={14} color={activeTab === "sharing" ? Colors.white : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === "sharing" && styles.tabTextActive]}>
              Sharing To
            </Text>
            {totalSharingTo > 0 && (
              <View style={[styles.tabCount, activeTab === "sharing" && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === "sharing" && styles.tabCountTextActive]}>
                  {totalSharingTo}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === "viewing" ? (
        viewingData.length === 0 ? (
          <EmptyState tab="viewing" />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {friendLocations.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
                    <Users size={14} color="#3B82F6" />
                  </View>
                  <Text style={[styles.sectionTitle, { color: "#3B82F6" }]}>Close Friends</Text>
                  <View style={[styles.sectionCount, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
                    <Text style={[styles.sectionCountText, { color: "#3B82F6" }]}>{friendLocations.length}</Text>
                  </View>
                </View>
                {viewingData
                  .filter((d) => d.type === "close_friend")
                  .map((d) => (
                    <SharingUserCard
                      key={`view-cf-${d.friend.userId}`}
                      friend={d.friend}
                      distance={d.distance}
                      type={d.type}
                    />
                  ))}
              </View>
            )}
            {familyLocations.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: "rgba(168,85,247,0.12)" }]}>
                    <Heart size={14} color="#A855F7" />
                  </View>
                  <Text style={[styles.sectionTitle, { color: "#A855F7" }]}>Family</Text>
                  <View style={[styles.sectionCount, { backgroundColor: "rgba(168,85,247,0.12)" }]}>
                    <Text style={[styles.sectionCountText, { color: "#A855F7" }]}>{familyLocations.length}</Text>
                  </View>
                </View>
                {viewingData
                  .filter((d) => d.type === "family")
                  .map((d) => (
                    <SharingUserCard
                      key={`view-fam-${d.friend.userId}`}
                      friend={d.friend}
                      distance={d.distance}
                      type={d.type}
                    />
                  ))}
              </View>
            )}
          </ScrollView>
        )
      ) : sharingToData.length === 0 ? (
        <EmptyState tab="sharing" />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {closeFriends.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
                  <Users size={14} color="#3B82F6" />
                </View>
                <Text style={[styles.sectionTitle, { color: "#3B82F6" }]}>Close Friends</Text>
                <View style={[styles.sectionCount, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
                  <Text style={[styles.sectionCountText, { color: "#3B82F6" }]}>{closeFriends.length}</Text>
                </View>
                <View style={[
                  styles.sharingStatusPill,
                  { backgroundColor: closeFriendSharingEnabled ? "rgba(76,175,80,0.12)" : "rgba(102,102,102,0.12)" },
                ]}>
                  <View style={[
                    styles.sharingStatusDot,
                    { backgroundColor: closeFriendSharingEnabled ? Colors.success : Colors.textMuted },
                  ]} />
                  <Text style={[
                    styles.sharingStatusText,
                    { color: closeFriendSharingEnabled ? Colors.success : Colors.textMuted },
                  ]}>
                    {closeFriendSharingEnabled ? "Active" : "Paused"}
                  </Text>
                </View>
              </View>
              {sharingToData
                .filter((d) => d.type === "close_friend")
                .map((d) => (
                  <SharingToCard
                    key={`share-cf-${d.friend.userId}`}
                    friend={d.friend}
                    type={d.type}
                    isActive={d.isActive}
                  />
                ))}
            </View>
          )}
          {familyMembers.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "rgba(168,85,247,0.12)" }]}>
                  <Heart size={14} color="#A855F7" />
                </View>
                <Text style={[styles.sectionTitle, { color: "#A855F7" }]}>Family</Text>
                <View style={[styles.sectionCount, { backgroundColor: "rgba(168,85,247,0.12)" }]}>
                  <Text style={[styles.sectionCountText, { color: "#A855F7" }]}>{familyMembers.length}</Text>
                </View>
                <View style={[
                  styles.sharingStatusPill,
                  { backgroundColor: familySharingEnabled ? "rgba(76,175,80,0.12)" : "rgba(102,102,102,0.12)" },
                ]}>
                  <View style={[
                    styles.sharingStatusDot,
                    { backgroundColor: familySharingEnabled ? Colors.success : Colors.textMuted },
                  ]} />
                  <Text style={[
                    styles.sharingStatusText,
                    { color: familySharingEnabled ? Colors.success : Colors.textMuted },
                  ]}>
                    {familySharingEnabled ? "Active" : "Paused"}
                  </Text>
                </View>
              </View>
              {sharingToData
                .filter((d) => d.type === "family")
                .map((d) => (
                  <SharingToCard
                    key={`share-fam-${d.friend.userId}`}
                    friend={d.friend}
                    type={d.type}
                    isActive={d.isActive}
                  />
                ))}
            </View>
          )}

          <View style={styles.infoCard}>
            <Wifi size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Toggle sharing on/off from the Map tab using the Close Friends and Family buttons.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  tabContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 3,
    position: "relative" as const,
  },
  tabIndicator: {
    position: "absolute" as const,
    top: 3,
    bottom: 3,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    zIndex: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.textMuted,
  },
  tabCountTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  sectionCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  sharingStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: "auto",
  },
  sharingStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sharingStatusText: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  distance: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  timeAgo: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});

const sharingToStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500" as const,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center" as const,
    lineHeight: 19,
  },
});
