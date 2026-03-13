import React, { useState, useCallback } from "react";
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
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  DollarSign,
  MapPin,
  Clock,
  X,
  Info,
  Plus,
  Crosshair,
} from "lucide-react-native";

import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useLocation } from "@/providers/LocationProvider";
import { OpeningHours } from "@/types";

const DEFAULT_HOURS: OpeningHours = {
  monday: "9:00 AM - 10:00 PM",
  tuesday: "9:00 AM - 10:00 PM",
  wednesday: "9:00 AM - 10:00 PM",
  thursday: "9:00 AM - 10:00 PM",
  friday: "9:00 AM - 11:00 PM",
  saturday: "10:00 AM - 11:00 PM",
  sunday: "10:00 AM - 9:00 PM",
};

export default function AddRestaurantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addRestaurant } = useRestaurants();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [photos, setPhotos] = useState<string[]>([]);
  const [openingHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const { userLocation, locationLoading, requestLocation } = useLocation();

  const useCurrentLocation = useCallback(() => {
    if (userLocation) {
      setLatitude(userLocation.latitude);
      setLongitude(userLocation.longitude);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log("[AddRestaurant] Using current location:", userLocation);
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

  const handleSubmit = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to register a business.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a business name.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Required", "Please enter an address.");
      return;
    }

    const defaultPhoto =
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80";

    const finalLat = latitude ?? (userLocation?.latitude ?? 40.748) + (Math.random() - 0.5) * 0.02;
    const finalLng = longitude ?? (userLocation?.longitude ?? -73.985) + (Math.random() - 0.5) * 0.02;

    await addRestaurant({
      ownerId: user.id,
      name: name.trim(),
      description: description.trim() || "A wonderful place.",

      photos: photos.length > 0 ? photos : [defaultPhoto],
      address: address.trim(),
      latitude: finalLat,
      longitude: finalLng,
      openingHours,
      phone: phone.trim() || undefined,

    });

    console.log("[AddRestaurant] Registered at:", finalLat, finalLng);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success!", "Your business has been registered.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }, [user, name, description, address, phone, photos, openingHours, addRestaurant, router, latitude, longitude, userLocation]);

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
        <View style={styles.feeNotice}>
          <DollarSign size={18} color={Colors.star} />
          <View style={styles.feeTextContainer}>
            <Text style={styles.feeTitle}>Registration Fee: $5.00</Text>
            <Text style={styles.feeSubtitle}>
              Free in beta version period.
            </Text>
          </View>
        </View>

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
              testID="restaurant-name-input"
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
              testID="use-current-location"
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
            {latitude === null && (
              <Text style={styles.locationHint}>
                Tap to pin your shop on the map. If not set, a nearby default will be used.
              </Text>
            )}
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
          <View style={styles.hoursHeader}>
            <Clock size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Opening Hours</Text>
          </View>
          <View style={styles.infoBox}>
            <Info size={14} color={Colors.textSecondary} />
            <Text style={styles.infoBoxText}>
              Default hours have been set. You can edit them after registration.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          testID="submit-restaurant"
        >
          <Plus size={18} color={Colors.white} />
          <Text style={styles.submitText}>Register Business — $5.00</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  feeNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 184, 0, 0.1)",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.2)",
    marginBottom: 24,
  },
  feeTextContainer: {
    flex: 1,
  },
  feeTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.star,
  },
  feeSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
    gap: 8,
    marginBottom: 14,
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
    backgroundColor: Colors.primary,
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
  locationHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    paddingLeft: 2,
  },
});
