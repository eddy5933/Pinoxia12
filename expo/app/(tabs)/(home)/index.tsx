import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Search, Star, MapPin, Clock, Navigation2, Locate } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useFilteredRestaurants } from "@/providers/RestaurantProvider";
import { useLocation, getDistanceKm, formatDistance } from "@/providers/LocationProvider";
import { CUISINE_TYPES } from "@/mocks/restaurants";
import { Restaurant } from "@/types";

function RestaurantCard({ restaurant, index, distance }: { restaurant: Restaurant; index: number; distance: string | null }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const onPress = useCallback(() => {
    router.push(`/restaurant/${restaurant.id}`);
  }, [router, restaurant.id]);

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        testID={`restaurant-card-${index}`}
      >
        <View style={styles.card}>
          <Image
            source={{ uri: restaurant.photos[0] }}
            style={styles.cardImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.cardOverlay}>
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>{restaurant.priceRange}</Text>
            </View>
            {distance && (
              <View style={styles.distanceTag}>
                <Navigation2 size={10} color={Colors.white} />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName} numberOfLines={1}>
                {restaurant.name}
              </Text>
              <View style={styles.ratingBadge}>
                <Star size={12} color={Colors.star} fill={Colors.star} />
                <Text style={styles.ratingText}>{restaurant.rating}</Text>
              </View>
            </View>
            <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.footerText} numberOfLines={1}>
                  {restaurant.address}
                </Text>
              </View>
              <View style={styles.footerItem}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.footerText}>{restaurant.reviewCount} reviews</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const filteredRestaurants = useFilteredRestaurants(search, selectedCuisine);
  const { userLocation, locationLoading, locationError, requestLocation } = useLocation();

  const distanceMap = useMemo(() => {
    if (!userLocation) return new Map<string, string>();
    const map = new Map<string, string>();
    filteredRestaurants.forEach((r) => {
      const km = getDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        r.latitude,
        r.longitude
      );
      map.set(r.id, formatDistance(km));
    });
    return map;
  }, [userLocation, filteredRestaurants]);

  const renderItem = useCallback(
    ({ item, index }: { item: Restaurant; index: number }) => (
      <RestaurantCard restaurant={item} index={index} distance={distanceMap.get(item.id) ?? null} />
    ),
    [distanceMap]
  );

  const keyExtractor = useCallback((item: Restaurant) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>FoodSpot</Text>
            <Text style={styles.subtitle}>Discover amazing restaurants</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.locateBtn,
              userLocation && styles.locateBtnActive,
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void requestLocation();
            }}
            disabled={locationLoading}
            activeOpacity={0.7}
            testID="home-locate-button"
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Locate size={18} color={userLocation ? Colors.primary : Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>
        {userLocation && (
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <Text style={styles.locationLabel}>
              GPS active · {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
        {locationError && !userLocation && (
          <TouchableOpacity style={styles.locationErrorRow} onPress={() => void requestLocation()}>
            <Text style={styles.locationErrorText}>{locationError}</Text>
            <Text style={styles.locationRetryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants, cuisines..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          testID="search-input"
        />
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {CUISINE_TYPES.map((cuisine) => (
            <TouchableOpacity
              key={cuisine}
              style={[
                styles.filterChip,
                selectedCuisine === cuisine && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCuisine(cuisine)}
              testID={`filter-${cuisine}`}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCuisine === cuisine && styles.filterChipTextActive,
                ]}
              >
                {cuisine}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRestaurants}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Search size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No restaurants found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or filter</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.white,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  filterSection: {
    marginTop: 14,
    marginBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: "700" as const,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  cardWrapper: {
    marginBottom: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImage: {
    width: "100%",
    height: 180,
  },
  cardOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 6,
    alignItems: "flex-end" as const,
  },
  priceTag: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    color: Colors.star,
    fontWeight: "700" as const,
    fontSize: 13,
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    color: Colors.star,
    fontWeight: "700" as const,
    fontSize: 13,
  },
  cuisineText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  locateBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locateBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(230,57,70,0.08)",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  locationLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  locationErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    backgroundColor: "rgba(230,57,70,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationErrorText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "500" as const,
  },
  locationRetryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  distanceTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(230,57,70,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceText: {
    color: Colors.white,
    fontWeight: "700" as const,
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
