import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  MapPin,
  Clock,
  X,
  Info,
  Check,
  Crosshair,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useLocation } from "@/providers/LocationProvider";
import { CUISINE_TYPES } from "@/mocks/restaurants";
import { OpeningHours } from "@/types";

const PRICE_OPTIONS: Array<"$" | "$$" | "$$$"> = ["$", "$$", "$$$"];

export default function EditRestaurantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { restaurants, updateRestaurant } = useRestaurants();
  const { userLocation, locationLoading, requestLocation } = useLocation();

  const restaurant = restaurants.find((r) => r.id === id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [priceRange, setPriceRange] = useState<"$" | "$$" | "$$$">("$$");
  const [photos, setPhotos] = useState<string[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHours>({
    monday: "9:00 AM - 10:00 PM",
    tuesday: "9:00 AM - 10:00 PM",
    wednesday: "9:00 AM - 10:00 PM",
    thursday: "9:00 AM - 10:00 PM",
    friday: "9:00 AM - 11:00 PM",
    saturday: "10:00 AM - 11:00 PM",
    sunday: "10:00 AM - 9:00 PM",
  });
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setDescription(restaurant.description);
      setCuisine(restaurant.cuisine ?? "");
      setAddress(restaurant.address);
      setPhone(restaurant.phone ?? "");
      setPriceRange(restaurant.priceRange);
      setPhotos([...restaurant.photos]);
      setOpeningHours({ ...restaurant.openingHours });
      setLatitude(restaurant.latitude);
      setLongitude(restaurant.longitude);
      console.log("[EditRestaurant] Loaded restaurant data:", restaurant.name);
    }
  }, [restaurant]);

  const useCurrentLocation = useCallback(() => {
    if (userLocation) {
      setLatitude(userLocation.latitude);
      setLongitude(userLocation.longitude);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log("[EditRestaurant] Updated location to:", userLocation);
    } else {
      void requestLocation();
      Alert.alert("Detecting Location", "Please wait for GPS and try again.");
    }
  }, [userLocation, requestLocation]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      console.log("Image picker error:", e);
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user || !id) return;

    if (!name.trim()) {
      Alert.alert("Required", "Please enter a business name.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Required", "Please enter an address.");
      return;
    }
    if (photos.length === 0) {
      Alert.alert("Required", "Please add at least one photo.");
      return;
    }

    await updateRestaurant(id, {
      name: name.trim(),
      description: description.trim() || "A wonderful place.",
      cuisine: cuisine || undefined,
      photos,
      address: address.trim(),
      latitude: latitude ?? restaurant?.latitude ?? 0,
      longitude: longitude ?? restaurant?.longitude ?? 0,
      openingHours,
      phone: phone.trim() || undefined,
      priceRange,
    });

    console.log("[EditRestaurant] Saved changes for:", id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", "Your business has been updated.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }, [user, id, name, description, cuisine, address, phone, photos, openingHours, priceRange, latitude, longitude, updateRestaurant, router, restaurant]);

  const updateHour = useCallback((day: keyof OpeningHours, value: string) => {
    setOpeningHours((prev) => ({ ...prev, [day]: value }));
  }, []);

  const cuisineOptions = CUISINE_TYPES.filter((c) => c !== "All");

  const DAYS: Array<keyof OpeningHours> = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const DAY_LABELS: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };

  if (!restaurant) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <Text style={styles.errorText}>Business not found</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (user?.id !== restaurant.ownerId) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <Text style={styles.errorText}>You don't own this business</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter business name"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              testID="edit-restaurant-name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your business..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cuisine Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {cuisineOptions.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, cuisine === c && styles.chipActive]}
                  onPress={() => setCuisine(cuisine === c ? "" : c)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      cuisine === c && styles.chipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price Range</Text>
            <View style={styles.priceRow}>
              {PRICE_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priceOption,
                    priceRange === p && styles.priceOptionActive,
                  ]}
                  onPress={() => setPriceRange(p)}
                >
                  <Text
                    style={[
                      styles.priceOptionText,
                      priceRange === p && styles.priceOptionTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Contact</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <View style={styles.inputWithIcon}>
              <MapPin size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.inputInner}
                placeholder="Enter full address"
                placeholderTextColor={Colors.textMuted}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Location on Map</Text>
            <TouchableOpacity
              style={[
                styles.locationButton,
                latitude !== null && styles.locationButtonActive,
              ]}
              onPress={useCurrentLocation}
              disabled={locationLoading}
              activeOpacity={0.7}
            >
              <Crosshair
                size={18}
                color={latitude !== null ? Colors.white : Colors.primary}
              />
              <Text
                style={[
                  styles.locationButtonText,
                  latitude !== null && styles.locationButtonTextActive,
                ]}
              >
                {locationLoading
                  ? "Detecting location..."
                  : latitude !== null
                  ? `Location set (${latitude.toFixed(4)}, ${longitude?.toFixed(4)})`
                  : "Use Current GPS Location"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555-0100"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, i) => (
              <View key={i} style={styles.photoItem}>
                <Image
                  source={{ uri: photo }}
                  style={styles.photoPreview}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(i)}
                >
                  <X size={14} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPhotoBtn} onPress={() => void pickImage()}>
              <Camera size={24} color={Colors.textMuted} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.hoursHeader}
            onPress={() => setEditingHours(!editingHours)}
            activeOpacity={0.7}
          >
            <View style={styles.hoursHeaderLeft}>
              <Clock size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Opening Hours</Text>
            </View>
            <Text style={styles.hoursToggleText}>
              {editingHours ? "Done" : "Edit"}
            </Text>
          </TouchableOpacity>
          {editingHours ? (
            <View style={styles.hoursEditGrid}>
              {DAYS.map((day) => (
                <View key={day} style={styles.hoursEditRow}>
                  <Text style={styles.hoursDay}>{DAY_LABELS[day]}</Text>
                  <TextInput
                    style={styles.hoursInput}
                    value={openingHours[day]}
                    onChangeText={(val) => updateHour(day, val)}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.hoursDisplayGrid}>
              {DAYS.map((day) => (
                <View key={day} style={styles.hoursDisplayRow}>
                  <Text style={styles.hoursDay}>{DAY_LABELS[day]}</Text>
                  <Text style={styles.hoursTime}>{openingHours[day]}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.infoBox}>
            <Info size={14} color={Colors.textSecondary} />
            <Text style={styles.infoBoxText}>
              Tap "Edit" above to change your opening hours.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => void handleSave()}
          testID="save-restaurant"
        >
          <Check size={18} color={Colors.white} />
          <Text style={styles.submitText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  errorBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  errorBtnText: {
    color: Colors.white,
    fontWeight: "600" as const,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  textArea: {
    minHeight: 80,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.white,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  chipScroll: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  chipTextActive: {
    color: Colors.white,
    fontWeight: "700" as const,
  },
  priceRow: {
    flexDirection: "row",
    gap: 10,
  },
  priceOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  priceOptionText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  priceOptionTextActive: {
    color: Colors.white,
    fontWeight: "700" as const,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addPhotoText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  hoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  hoursHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hoursToggleText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  hoursEditGrid: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  hoursEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hoursDay: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    width: 40,
  },
  hoursInput: {
    flex: 1,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  hoursDisplayGrid: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  hoursDisplayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hoursTime: {
    fontSize: 13,
    color: Colors.white,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoBoxText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  locationButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  locationButtonActive: {
    backgroundColor: Colors.primary,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  locationButtonTextActive: {
    color: Colors.white,
  },
});
