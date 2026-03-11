import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, MapPin, Plus, Store, Pencil, Trash2 } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { Restaurant } from "@/types";

function OwnerRestaurantCard({ restaurant, onDelete }: { restaurant: Restaurant; onDelete: (id: string) => void }) {
  const router = useRouter();

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Business",
      `Are you sure you want to delete "${restaurant.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(restaurant.id),
        },
      ]
    );
  }, [restaurant.id, restaurant.name, onDelete]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
    >
      <Image
        source={{ uri: restaurant.photos[0] }}
        style={styles.cardImage}
        contentFit="cover"
      />
      <View style={styles.badgeRow}>
        <TouchableOpacity
          style={styles.editBadge}
          onPress={() => router.push({ pathname: "/edit-restaurant", params: { id: restaurant.id } })}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Pencil size={14} color={Colors.white} />
          <Text style={styles.editBadgeText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBadge}
          onPress={handleDelete}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Trash2 size={14} color={Colors.white} />
          <Text style={styles.deleteBadgeText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.cardCuisine}>{restaurant.cuisine}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Star size={12} color={Colors.star} fill={Colors.star} />
            <Text style={styles.metaText}>
              {restaurant.rating > 0 ? restaurant.rating : "New"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.metaTextMuted} numberOfLines={1}>
              {restaurant.address}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{restaurant.reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{restaurant.priceRange}</Text>
            <Text style={styles.statLabel}>Price</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyRestaurantsScreen() {
  const { user } = useAuth();
  const { getRestaurantsByOwner, deleteRestaurant } = useRestaurants();
  const router = useRouter();

  const myRestaurants = useMemo(
    () => (user ? getRestaurantsByOwner(user.id) : []),
    [user, getRestaurantsByOwner]
  );

  const handleDelete = useCallback((id: string) => {
    deleteRestaurant(id);
    console.log("[MyRestaurants] Deleted business:", id);
  }, [deleteRestaurant]);

  const renderItem = useCallback(
    ({ item }: { item: Restaurant }) => <OwnerRestaurantCard restaurant={item} onDelete={handleDelete} />,
    [handleDelete]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={myRestaurants}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Store size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Businesses Yet</Text>
            <Text style={styles.emptySubtitle}>
              Register your first shop, restaurant or service to start getting customers and
              reviews
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/add-restaurant")}
            >
              <Plus size={18} color={Colors.white} />
              <Text style={styles.addButtonText}>Register Business</Text>
            </TouchableOpacity>
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
  listContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImage: {
    width: "100%",
    height: 160,
  },
  badgeRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    zIndex: 2,
  },
  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editBadgeText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  deleteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200,30,30,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteBadgeText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  cardContent: {
    padding: 16,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cardCuisine: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  metaTextMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.white,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
