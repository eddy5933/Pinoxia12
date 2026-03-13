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
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Check,
  X,
  ChevronDown,
  Coffee,
  ShoppingBag,
  TreePine,
  Dumbbell,
  Sun,
  Sunrise,
  UtensilsCrossed,
  Plus,
  Navigation,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useEvents } from "@/providers/EventProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useLocation } from "@/providers/LocationProvider";
import { EventType } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface EventTypeOption {
  value: EventType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const EVENT_TYPES: EventTypeOption[] = [
  { value: "breakfast", label: "Breakfast", icon: <Sunrise size={20} color="#FF9800" />, color: "#FF9800" },
  { value: "lunch", label: "Lunch", icon: <Sun size={20} color="#FFC107" />, color: "#FFC107" },
  { value: "dinner", label: "Dinner", icon: <UtensilsCrossed size={20} color="#E63946" />, color: "#E63946" },
  { value: "coffee", label: "Coffee", icon: <Coffee size={20} color="#8D6E63" />, color: "#8D6E63" },
  { value: "shopping", label: "Shopping", icon: <ShoppingBag size={20} color="#AB47BC" />, color: "#AB47BC" },
  { value: "picnic", label: "Picnic", icon: <TreePine size={20} color="#66BB6A" />, color: "#66BB6A" },
  { value: "sport", label: "Sport", icon: <Dumbbell size={20} color="#42A5F5" />, color: "#42A5F5" },
];

interface SelectedPlace {
  name: string;
  latitude: number;
  longitude: number;
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { createEvent, isCreating } = useEvents();
  const { friends } = useFriends();
  const { restaurants } = useRestaurants();
  const { userLocation } = useLocation();

  const [eventType, setEventType] = useState<EventType | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [showAddCustomPlace, setShowAddCustomPlace] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [customLat, setCustomLat] = useState("");
  const [customLng, setCustomLng] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [placeSearch, setPlaceSearch] = useState("");

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

  const filteredRestaurants = useMemo(() => {
    if (!placeSearch.trim()) return restaurants.slice(0, 20);
    const q = placeSearch.toLowerCase();
    return restaurants.filter(
      (r) => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [restaurants, placeSearch]);

  const selectedTypeOption = useMemo(
    () => EVENT_TYPES.find((t) => t.value === eventType),
    [eventType]
  );

  const canSubmit = useMemo(() => {
    return (
      eventType !== null &&
      title.trim().length > 0 &&
      selectedPlace !== null &&
      date.trim().length > 0 &&
      time.trim().length > 0 &&
      selectedFriends.size > 0
    );
  }, [eventType, title, selectedPlace, date, time, selectedFriends]);

  const handleSelectType = useCallback((type: EventType) => {
    setEventType(type);
    setShowTypePicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectPlace = useCallback((restaurant: { name: string; latitude: number; longitude: number }) => {
    setSelectedPlace({
      name: restaurant.name,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    });
    setShowPlacePicker(false);
    setPlaceSearch("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleAddCustomPlace = useCallback(() => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (!customPlaceName.trim()) {
      Alert.alert("Missing Name", "Please enter a place name");
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert("Invalid Coordinates", "Please enter valid latitude and longitude");
      return;
    }
    setSelectedPlace({
      name: customPlaceName.trim(),
      latitude: lat,
      longitude: lng,
    });
    setShowAddCustomPlace(false);
    setShowPlacePicker(false);
    setCustomPlaceName("");
    setCustomLat("");
    setCustomLng("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [customPlaceName, customLat, customLng]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!userLocation) {
      Alert.alert("Location Unavailable", "Your current location is not available.");
      return;
    }
    if (!customPlaceName.trim()) {
      Alert.alert("Missing Name", "Please enter a place name first");
      return;
    }
    setCustomLat(userLocation.latitude.toFixed(6));
    setCustomLng(userLocation.longitude.toFixed(6));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [userLocation, customPlaceName]);

  const handleCreate = useCallback(async () => {
    if (!user || !canSubmit || !selectedPlace || !eventType) return;

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
        eventType,
        restaurantName: selectedPlace.name,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
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
  }, [user, canSubmit, selectedPlace, eventType, date, time, title, description, selectedFriendsList, createEvent, router]);

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
          title: "Create Event",
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
          <View style={[styles.heroIcon, selectedTypeOption ? { backgroundColor: selectedTypeOption.color + "20" } : undefined]}>
            {selectedTypeOption ? (
              <View>{selectedTypeOption.icon}</View>
            ) : (
              <UtensilsCrossed size={32} color={Colors.primary} />
            )}
          </View>
          <Text style={styles.heroTitle}>New Event</Text>
          <Text style={styles.heroSubtitle}>
            Pick a type, place, and invite friends
          </Text>
        </View>

        {/* Event Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Type</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowTypePicker(!showTypePicker)}
            activeOpacity={0.7}
            testID="event-type-picker"
          >
            {selectedTypeOption ? (
              <View style={styles.dropdownSelected}>
                {selectedTypeOption.icon}
                <Text style={styles.dropdownSelectedText}>{selectedTypeOption.label}</Text>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Select event type</Text>
            )}
            <ChevronDown
              size={18}
              color={Colors.textMuted}
              style={{ transform: [{ rotate: showTypePicker ? "180deg" : "0deg" }] }}
            />
          </TouchableOpacity>

          {showTypePicker && (
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map((type) => {
                const isActive = eventType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeCard,
                      isActive && { borderColor: type.color, backgroundColor: type.color + "14" },
                    ]}
                    onPress={() => handleSelectType(type.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIconWrap, { backgroundColor: type.color + "1A" }]}>
                      {type.icon}
                    </View>
                    <Text style={[styles.typeLabel, isActive && { color: type.color }]}>
                      {type.label}
                    </Text>
                    {isActive && (
                      <View style={[styles.typeCheck, { backgroundColor: type.color }]}>
                        <Check size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder={selectedTypeOption ? `e.g. ${selectedTypeOption.label} with friends` : "e.g. Friday Night Out"}
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            testID="event-title-input"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any details for your friends?"
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            testID="event-description-input"
          />
        </View>

        {/* Place */}
        <View style={styles.section}>
          <Text style={styles.label}>Place</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowPlacePicker(!showPlacePicker)}
            activeOpacity={0.7}
            testID="place-picker-toggle"
          >
            <MapPin size={18} color={selectedPlace ? Colors.primary : Colors.textMuted} />
            <Text style={selectedPlace ? styles.dropdownSelectedText : styles.dropdownPlaceholder} numberOfLines={1}>
              {selectedPlace ? selectedPlace.name : "Select a place"}
            </Text>
            <ChevronDown
              size={18}
              color={Colors.textMuted}
              style={{ transform: [{ rotate: showPlacePicker ? "180deg" : "0deg" }] }}
            />
          </TouchableOpacity>

          {selectedPlace && !showPlacePicker && (
            <View style={styles.placePreview}>
              <Navigation size={14} color={Colors.textSecondary} />
              <Text style={styles.placeCoords}>
                {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPlace(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Place Picker Modal */}
        <Modal
          visible={showPlacePicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => { setShowPlacePicker(false); setShowAddCustomPlace(false); }}
        >
          <View style={[styles.modalContainer, { paddingTop: Platform.OS === "ios" ? 12 : insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Place</Text>
              <TouchableOpacity
                onPress={() => { setShowPlacePicker(false); setShowAddCustomPlace(false); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {!showAddCustomPlace ? (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search restaurants..."
                    placeholderTextColor={Colors.textMuted}
                    value={placeSearch}
                    onChangeText={setPlaceSearch}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={styles.addCustomButton}
                  onPress={() => setShowAddCustomPlace(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addCustomIcon}>
                    <Plus size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.addCustomText}>Add a new place</Text>
                </TouchableOpacity>

                <ScrollView style={styles.placeList} keyboardShouldPersistTaps="handled">
                  {filteredRestaurants.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.placeItem}
                      onPress={() => handleSelectPlace(r)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.placeItemIcon}>
                        <MapPin size={16} color={Colors.primary} />
                      </View>
                      <View style={styles.placeItemContent}>
                        <Text style={styles.placeItemName} numberOfLines={1}>{r.name}</Text>
                        <Text style={styles.placeItemAddress} numberOfLines={1}>{r.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {filteredRestaurants.length === 0 && (
                    <Text style={styles.noResultsText}>No places found. Try adding a new one!</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <View style={styles.customPlaceForm}>
                <Text style={styles.customFormTitle}>Add New Place</Text>

                <View style={styles.section}>
                  <Text style={styles.label}>Place Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Central Park"
                    placeholderTextColor={Colors.textMuted}
                    value={customPlaceName}
                    onChangeText={setCustomPlaceName}
                    autoFocus
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="25.2854"
                      placeholderTextColor={Colors.textMuted}
                      value={customLat}
                      onChangeText={setCustomLat}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="51.5310"
                      placeholderTextColor={Colors.textMuted}
                      value={customLng}
                      onChangeText={setCustomLng}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {userLocation && (
                  <TouchableOpacity
                    style={styles.useLocationButton}
                    onPress={handleUseCurrentLocation}
                    activeOpacity={0.7}
                  >
                    <Navigation size={16} color={Colors.primary} />
                    <Text style={styles.useLocationText}>Use my current location</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.customFormActions}>
                  <TouchableOpacity
                    style={styles.customCancelButton}
                    onPress={() => setShowAddCustomPlace(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.customCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.customConfirmButton}
                    onPress={handleAddCustomPlace}
                    activeOpacity={0.8}
                  >
                    <Check size={18} color={Colors.white} />
                    <Text style={styles.customConfirmText}>Add Place</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Modal>

        {/* Date & Time */}
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

        {/* Friends */}
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
    paddingVertical: 24,
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
    minHeight: 64,
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
  dropdownButton: {
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
  dropdownPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
  },
  dropdownSelected: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropdownSelectedText: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    fontWeight: "500" as const,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  typeCard: {
    width: (SCREEN_WIDTH - 40 - 20) / 3,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: "relative" as const,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  typeCheck: {
    position: "absolute" as const,
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  placePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
  },
  placeCoords: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addCustomButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(230,57,70,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
  },
  addCustomIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(230,57,70,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  addCustomText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  placeList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  placeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  placeItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(230,57,70,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeItemContent: {
    flex: 1,
  },
  placeItemName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
    marginBottom: 2,
  },
  placeItemAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 30,
  },
  customPlaceForm: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  customFormTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 20,
  },
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(230,57,70,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.2)",
    marginBottom: 20,
  },
  useLocationText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  customFormActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  customCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customCancelText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  customConfirmButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    gap: 8,
  },
  customConfirmText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
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
