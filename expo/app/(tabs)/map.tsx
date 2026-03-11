import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Animated,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Star,
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  Crosshair,
  Search,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useLocation } from "@/providers/LocationProvider";
import type { UserLocation } from "@/providers/LocationProvider";
import { Restaurant } from "@/types";

const DEFAULT_REGION = {
  latitude: 40.748,
  longitude: -73.985,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function MapRestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={cardStyles.card}
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/restaurant/${restaurant.id}`);
        }}
        testID={`map-card-${restaurant.id}`}
      >
        <Image
          source={{ uri: restaurant.photos[0] }}
          style={cardStyles.image}
          contentFit="cover"
        />
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={cardStyles.cuisine}>{restaurant.cuisine}</Text>
          <View style={cardStyles.meta}>
            <Star size={11} color={Colors.star} fill={Colors.star} />
            <Text style={cardStyles.rating}>{restaurant.rating}</Text>
            <Text style={cardStyles.reviews}>({restaurant.reviewCount})</Text>
            <View style={cardStyles.dot} />
            <Text style={cardStyles.price}>{restaurant.priceRange}</Text>
          </View>
        </View>
        <View style={cardStyles.arrow}>
          <Navigation size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function NativeMapView({
  restaurants,
  userLocation,
  focusedRestaurant,
  centerTrigger,
}: {
  restaurants: Restaurant[];
  userLocation: UserLocation | null;
  focusedRestaurant: Restaurant | null;
  centerTrigger: number;
}) {
  const MapView =
    require("react-native-maps").default as typeof import("react-native-maps").default;
  const { Marker, Callout, PROVIDER_DEFAULT } =
    require("react-native-maps") as typeof import("react-native-maps");

  const mapRef = useRef<InstanceType<typeof MapView>>(null);
  const hasAnimatedToUser = useRef(false);
  const router = useRouter();

  const initialRegion = focusedRestaurant
    ? {
        latitude: focusedRestaurant.latitude,
        longitude: focusedRestaurant.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : DEFAULT_REGION;

  useEffect(() => {
    if (focusedRestaurant && mapRef.current) {
      console.log("[MapScreen] Animating to focused restaurant:", focusedRestaurant.name);
      mapRef.current.animateToRegion(
        {
          latitude: focusedRestaurant.latitude,
          longitude: focusedRestaurant.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        800
      );
    }
  }, [focusedRestaurant]);

  useEffect(() => {
    if (userLocation && mapRef.current && !hasAnimatedToUser.current && !focusedRestaurant) {
      console.log("[MapScreen] Auto-centering map on user location:", userLocation);
      hasAnimatedToUser.current = true;
      const nearbyRestaurants = restaurants.filter((r) => {
        const latDiff = Math.abs(r.latitude - userLocation.latitude);
        const lonDiff = Math.abs(r.longitude - userLocation.longitude);
        return latDiff < 0.1 && lonDiff < 0.1;
      });
      const delta = nearbyRestaurants.length > 0 ? 0.06 : 0.03;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        1000
      );
    }
  }, [userLocation, focusedRestaurant, restaurants]);

  useEffect(() => {
    if (centerTrigger > 0 && userLocation && mapRef.current) {
      console.log("[MapScreen] Centering map on user location via button");
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    }
  }, [centerTrigger, userLocation]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      customMapStyle={darkMapStyle}
    >
      {restaurants.map((r) => (
        <Marker
          key={r.id}
          coordinate={{ latitude: r.latitude, longitude: r.longitude }}
          pinColor={Colors.primary}
          onPress={() => {
            console.log("[MapScreen] Marker tapped:", r.name);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <View style={markerStyles.container}>
            <View style={[
              markerStyles.pin,
              focusedRestaurant?.id === r.id && markerStyles.pinFocused,
            ]}>
              <MapPin size={16} color={Colors.white} />
            </View>
            <View style={markerStyles.pinTail} />
            <View style={markerStyles.labelContainer}>
              <Text style={markerStyles.labelText} numberOfLines={1}>{r.name}</Text>
            </View>
          </View>
          <Callout
            tooltip
            onPress={() => {
              console.log("[MapScreen] Callout pressed, navigating to:", r.name);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/restaurant/${r.id}`);
            }}
          >
            <View style={markerStyles.callout}>
              <Text style={markerStyles.calloutName} numberOfLines={1}>{r.name}</Text>
              <View style={markerStyles.calloutRow}>
                <Star size={11} color={Colors.star} fill={Colors.star} />
                <Text style={markerStyles.calloutRating}>{r.rating}</Text>
                <Text style={markerStyles.calloutCuisine}> · {r.cuisine}</Text>
              </View>
              <Text style={markerStyles.calloutAddress} numberOfLines={1}>{r.address}</Text>
              <View style={markerStyles.calloutButton}>
                <Navigation size={11} color={Colors.white} />
                <Text style={markerStyles.calloutButtonText}>View Details</Text>
              </View>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

function WebMapView({
  restaurants,
  userLocation,
  onMarkerPress,
}: {
  restaurants: Restaurant[];
  userLocation: UserLocation | null;
  onMarkerPress: (id: string) => void;
}) {
  const center = userLocation ?? { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
  const bbox = `${center.longitude - 0.04},${center.latitude - 0.03},${center.longitude + 0.04},${center.latitude + 0.03}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  return (
    <View style={{ flex: 1 }}>
      <iframe
        src={mapUrl}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: 0,
        }}
        title="Restaurant Map"
      />
      <View style={webListStyles.overlay}>
        <FlatList
          data={restaurants}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={webListStyles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={webListStyles.card}
              activeOpacity={0.8}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMarkerPress(item.id);
              }}
              testID={`web-pin-${item.id}`}
            >
              <Image
                source={{ uri: item.photos[0] }}
                style={webListStyles.cardImage}
                contentFit="cover"
              />
              <View style={webListStyles.cardInfo}>
                <Text style={webListStyles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={webListStyles.cardMeta}>
                  <Star size={10} color={Colors.star} fill={Colors.star} />
                  <Text style={webListStyles.cardRating}>{item.rating}</Text>
                  <Text style={webListStyles.cardCuisine}> · {item.cuisine}</Text>
                </View>
                <View style={webListStyles.cardLink}>
                  <MapPin size={10} color={Colors.primary} />
                  <Text style={webListStyles.cardLinkText}>View details</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { restaurants } = useRestaurants();
  const { userLocation, locationLoading, locationError, requestLocation } = useLocation();
  const [listExpanded, setListExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const searchInputRef = useRef<TextInput>(null);
  const [centerTrigger, setCenterTrigger] = useState(0);

  const focusedRestaurant = useMemo(
    () => (focus ? restaurants.find((r) => r.id === focus) ?? null : null),
    [focus, restaurants]
  );

  useEffect(() => {
    if (focusedRestaurant) {
      console.log("[MapScreen] Focused on restaurant:", focusedRestaurant.name);
      setListExpanded(true);
    }
  }, [focusedRestaurant]);

  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return restaurants;
    const q = searchQuery.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
    );
  }, [restaurants, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.blur();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleMarkerPress = useCallback(
    (restaurantId: string) => {
      console.log("[MapScreen] Marker pressed:", restaurantId);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/restaurant/${restaurantId}`);
    },
    [router]
  );

  const toggleList = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListExpanded((prev) => !prev);
  }, []);

  const renderRestaurantItem = useCallback(
    ({ item }: { item: Restaurant }) => <MapRestaurantCard restaurant={item} />,
    []
  );

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MapPin size={18} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Explore Map</Text>
            <Text style={styles.headerSubtitle}>
              {restaurants.length} restaurants nearby
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.locateButton,
            locationLoading && styles.locateButtonLoading,
            userLocation && styles.locateButtonActive,
          ]}
          onPress={() => {
            if (userLocation) {
              console.log("[MapScreen] Centering on current location");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setCenterTrigger((prev) => prev + 1);
            } else {
              void requestLocation();
            }
          }}
          disabled={locationLoading}
          activeOpacity={0.7}
          testID="locate-button"
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Animated.View style={{ transform: [{ scale: userLocation ? pulseAnim : 1 }] }}>
              <Crosshair
                size={20}
                color={userLocation ? Colors.white : Colors.textSecondary}
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[
          styles.searchBar,
          searchFocused && styles.searchBarFocused,
        ]}>
          <Search size={16} color={searchFocused ? Colors.primary : Colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search restaurants, cuisine, area..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            testID="map-search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="map-search-clear"
            >
              <View style={styles.clearButton}>
                <X size={12} color={Colors.white} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.trim().length > 0 && (
          <Text style={styles.searchResultCount}>
            {filteredRestaurants.length} result{filteredRestaurants.length !== 1 ? "s" : ""} found
          </Text>
        )}
      </View>

      {userLocation && (
        <View style={styles.locationBanner}>
          <View style={styles.locationDot} />
          <Text style={styles.locationText} numberOfLines={1}>
            {userLocation.placeName ?? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
          </Text>
        </View>
      )}

      {locationError && (
        <TouchableOpacity style={styles.errorBanner} onPress={requestLocation}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Text style={styles.errorRetry}>Tap to retry</Text>
        </TouchableOpacity>
      )}

      <View style={styles.mapContainer}>
        {Platform.OS === "web" ? (
          <WebMapView restaurants={filteredRestaurants} userLocation={userLocation} onMarkerPress={handleMarkerPress} />
        ) : (
          <NativeMapView
            restaurants={filteredRestaurants}
            userLocation={userLocation}
            focusedRestaurant={focusedRestaurant}
            centerTrigger={centerTrigger}
          />
        )}


      </View>

      <View style={styles.bottomSheet}>
        <TouchableOpacity
          style={styles.toggleBar}
          onPress={toggleList}
          activeOpacity={0.7}
          testID="toggle-list"
        >
          <View style={styles.toggleHandle} />
          <View style={styles.toggleContent}>
            <Text style={styles.toggleText}>
              {filteredRestaurants.length} Restaurant{filteredRestaurants.length !== 1 ? "s" : ""}
            </Text>
            {listExpanded ? (
              <ChevronDown size={18} color={Colors.textSecondary} />
            ) : (
              <ChevronUp size={18} color={Colors.textSecondary} />
            )}
          </View>
        </TouchableOpacity>

        {listExpanded && (
          <FlatList
            data={filteredRestaurants}
            renderItem={renderRestaurantItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8e8e8e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a7a7a" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e0e0e" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#252525" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1a2e1a" }],
  },
];

const markerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  pinFocused: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.star,
    borderColor: Colors.star,
    shadowColor: Colors.star,
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.white,
    marginTop: -1,
  },
  labelContainer: {
    backgroundColor: "#E63946",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
    maxWidth: 120,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  labelText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    textAlign: "center" as const,
    letterSpacing: 0.3,
  },
  callout: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: 160,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 4,
  },
  calloutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 6,
  },
  calloutRating: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.star,
  },
  calloutCuisine: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  calloutAddress: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  calloutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  calloutButtonText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locateButtonLoading: {
    borderColor: Colors.primary,
  },
  locateButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(230,57,70,0.1)",
    gap: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(230,57,70,0.15)",
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: "500" as const,
  },
  errorRetry: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
    fontWeight: "500" as const,
    paddingVertical: 0,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    marginTop: 6,
    paddingLeft: 4,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },

  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toggleBar: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  toggleHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    marginBottom: 8,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
});

const webListStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    backgroundColor: "rgba(13,13,13,0.85)",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    width: 240,
  },
  cardImage: {
    width: 70,
    height: 80,
  },
  cardInfo: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  cardRating: {
    fontSize: 11,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  cardCuisine: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardLinkText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: 80,
    height: 80,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cuisine: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  reviews: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  price: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  arrow: {
    justifyContent: "center",
    paddingRight: 14,
  },
});
