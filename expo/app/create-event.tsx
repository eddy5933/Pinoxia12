import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  MapPin,
  Calendar,
  Clock,
  UtensilsCrossed,
  Users,
  Check,
  X,
  ChevronDown,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useEvents } from "@/providers/EventProvider";
import { useFriends } from "@/providers/FriendsProvider";

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { createEvent, isCreating } = useEvents();
  const { friends } = useFriends();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [showFriendPicker, setShowFriendPicker] = useState(false);

  const toggleFriend = useCallback((friendUserId: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(friendUserId)) {
        next.delete(friendUserId);
      } else {
        next.add(friendUserId);
      }
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const selectedFriendsList = useMemo(
    () => friends.filter((f) => selectedFriends.has(f.userId)),
    [friends, selectedFriends]
  );

  const canSubmit = useMemo(() => {
    return (
      title.trim().length > 0 &&
      restaurantName.trim().length > 0 &&
      address.trim().length > 0 &&
      date.trim().length > 0 &&
      time.trim().length > 0 &&
      selectedFriends.size > 0
    );
  }, [title, restaurantName, address, date, time, selectedFriends]);

  const handleCreate = useCallback(async () => {
    if (!user || !canSubmit) return;

    const lat = parseFloat(latitude) || 0;
    const lng = parseFloat(longitude) || 0;

    const dateTimeStr = `${date.trim()}T${time.trim()}:00`;
    const eventDate = new Date(dateTimeStr);
    if (isNaN(eventDate.getTime())) {
      Alert.alert("Invalid Date", "Please enter date as YYYY-MM-DD and time as HH:MM");
      return;
    }

    try {
      const invitedFriendIds = selectedFriendsList.map((f) => ({
        userId: f.userId,
        name: f.name,
      }));

      await createEvent({
        title: title.trim(),
        description: description.trim(),
        restaurantName: restaurantName.trim(),
        latitude: lat,
        longitude: lng,
        address: address.trim(),
        eventDate: eventDate.toISOString(),
        invitedFriendIds,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Event Created!", "Invitations have been sent to your friends.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.warn("[CreateEvent] Error:", err?.message);
      Alert.alert("Error", err?.message ?? "Failed to create event");
    }
  }, [user, canSubmit, latitude, longitude, date, time, title, description, restaurantName, address, selectedFriendsList, createEvent, router]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: "Create Event" }} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Please sign in to create events</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Create Dinner Event",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.white,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <UtensilsCrossed size={32} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Plan a Dinner</Text>
          <Text style={styles.heroSubtitle}>
            Invite your friends for a great meal together
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Friday Night Dinner"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            testID="event-title-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What's the occasion?"
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            testID="event-description-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Restaurant / Place</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color={Colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.inputWithIcon}
              placeholder="Restaurant name"
              placeholderTextColor={Colors.textMuted}
              value={restaurantName}
              onChangeText={setRestaurantName}
              testID="event-restaurant-input"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Full address of the venue"
            placeholderTextColor={Colors.textMuted}
            value={address}
            onChangeText={setAddress}
            testID="event-address-input"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={Colors.textMuted}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="decimal-pad"
              testID="event-lat-input"
            />
          </View>
          <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={Colors.textMuted}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="decimal-pad"
              testID="event-lng-input"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.inputRow}>
              <Calendar size={16} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={date}
                onChangeText={setDate}
                testID="event-date-input"
              />
            </View>
          </View>
          <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Time</Text>
            <View style={styles.inputRow}>
              <Clock size={16} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                placeholder="HH:MM"
                placeholderTextColor={Colors.textMuted}
                value={time}
                onChangeText={setTime}
                testID="event-time-input"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Invite Friends</Text>
          <TouchableOpacity
            style={styles.friendPickerToggle}
            onPress={() => setShowFriendPicker(!showFriendPicker)}
            activeOpacity={0.7}
            testID="friend-picker-toggle"
          >
            <Users size={18} color={Colors.primary} />
            <Text style={styles.friendPickerText}>
              {selectedFriends.size > 0
                ? `${selectedFriends.size} friend${selectedFriends.size > 1 ? "s" : ""} selected`
                : "Tap to select friends"}
            </Text>
            <ChevronDown
              size={18}
              color={Colors.textMuted}
              style={{ transform: [{ rotate: showFriendPicker ? "180deg" : "0deg" }] }}
            />
          </TouchableOpacity>

          {showFriendPicker && (
            <View style={styles.friendList}>
              {friends.length === 0 ? (
                <Text style={styles.noFriendsText}>
                  No friends yet. Add friends first!
                </Text>
              ) : (
                friends.map((friend) => {
                  const isSelected = selectedFriends.has(friend.userId);
                  return (
                    <TouchableOpacity
                      key={friend.userId}
                      style={[
                        styles.friendItem,
                        isSelected && styles.friendItemSelected,
                      ]}
                      onPress={() => toggleFriend(friend.userId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>
                          {friend.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.friendName,
                          isSelected && styles.friendNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {friend.name}
                      </Text>
                      {isSelected ? (
                        <View style={styles.checkCircle}>
                          <Check size={14} color={Colors.white} />
                        </View>
                      ) : (
                        <View style={styles.emptyCircle} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {selectedFriendsList.length > 0 && !showFriendPicker && (
            <View style={styles.selectedChips}>
              {selectedFriendsList.map((f) => (
                <View key={f.userId} style={styles.chip}>
                  <Text style={styles.chipText}>{f.name}</Text>
                  <TouchableOpacity
                    onPress={() => toggleFriend(f.userId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
          onPress={() => void handleCreate()}
          disabled={!canSubmit || isCreating}
          activeOpacity={0.8}
          testID="create-event-button"
        >
          {isCreating ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.createButtonText}>Send Invitations</Text>
          )}
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
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 28,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(230,57,70,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.white,
  },
  row: {
    flexDirection: "row",
  },
  friendPickerToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  friendPickerText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  friendList: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    maxHeight: 300,
  },
  noFriendsText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 20,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  friendItemSelected: {
    backgroundColor: "rgba(230,57,70,0.08)",
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
  },
  friendAvatarText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  friendName: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    fontWeight: "500" as const,
  },
  friendNameSelected: {
    color: Colors.primary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selectedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: "500" as const,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
