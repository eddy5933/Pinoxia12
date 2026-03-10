import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Phone,
  Utensils,
  ChevronDown,
  ChevronUp,
  Send,
  Navigation,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useAuth } from "@/providers/AuthProvider";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function StarRating({
  rating,
  onRate,
  size = 24,
}: {
  rating: number;
  onRate?: (r: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => onRate?.(s)}
          disabled={!onRate}
        >
          <Star
            size={size}
            color={Colors.star}
            fill={s <= rating ? Colors.star : "transparent"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { restaurants, getReviewsForRestaurant, addReview } = useRestaurants();
  const { user } = useAuth();

  const [showHours, setShowHours] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const submitScale = useRef(new Animated.Value(1)).current;

  const restaurant = useMemo(
    () => restaurants.find((r) => r.id === id),
    [restaurants, id]
  );

  const reviews = useMemo(
    () => (id ? getReviewsForRestaurant(id) : []),
    [id, getReviewsForRestaurant]
  );

  const handleSubmitReview = useCallback(() => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to leave a review.");
      router.push("/login");
      return;
    }
    if (reviewRating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert("Comment Required", "Please write a comment.");
      return;
    }
    if (!id) return;

    addReview({
      restaurantId: id,
      userId: user.id,
      userName: user.name,
      rating: reviewRating,
      comment: reviewComment.trim(),
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReviewRating(0);
    setReviewComment("");
    setShowReviewForm(false);
  }, [user, reviewRating, reviewComment, id, addReview, router]);

  if (!restaurant) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Restaurant not found</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: restaurant.photos[photoIndex] }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heroOverlay} />
          <TouchableOpacity
            style={[styles.heroBackButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            <View style={styles.heroBadges}>
              <View style={styles.heroBadge}>
                <Utensils size={12} color={Colors.primary} />
                <Text style={styles.heroBadgeText}>{restaurant.cuisine}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {restaurant.priceRange}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {restaurant.photos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {restaurant.photos.map((photo, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setPhotoIndex(i)}
                style={[
                  styles.photoThumb,
                  photoIndex === i && styles.photoThumbActive,
                ]}
              >
                <Image
                  source={{ uri: photo }}
                  style={styles.photoThumbImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.ratingRow}>
          <StarRating rating={Math.round(restaurant.rating)} size={20} />
          <Text style={styles.ratingValue}>{restaurant.rating}</Text>
          <Text style={styles.reviewCount}>
            ({restaurant.reviewCount} reviews)
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.description}>{restaurant.description}</Text>

          <TouchableOpacity
            style={styles.mapLinkRow}
            activeOpacity={0.7}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate({
                pathname: "/map",
                params: { focus: restaurant.id },
              });
            }}
            testID="view-on-map"
          >
            <View style={styles.mapLinkLeft}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={styles.infoText}>{restaurant.address}</Text>
            </View>
            <View style={styles.mapLinkBadge}>
              <Navigation size={12} color={Colors.white} />
              <Text style={styles.mapLinkBadgeText}>Map</Text>
            </View>
          </TouchableOpacity>

          {restaurant.phone && (
            <View style={styles.infoRow}>
              <Phone size={16} color={Colors.primary} />
              <Text style={styles.infoText}>{restaurant.phone}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.hoursToggle}
            onPress={() => setShowHours(!showHours)}
          >
            <View style={styles.infoRow}>
              <Clock size={16} color={Colors.primary} />
              <Text style={styles.infoText}>Opening Hours</Text>
            </View>
            {showHours ? (
              <ChevronUp size={18} color={Colors.textMuted} />
            ) : (
              <ChevronDown size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          {showHours && (
            <View style={styles.hoursGrid}>
              {DAYS.map((day) => (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{DAY_LABELS[day]}</Text>
                  <Text style={styles.hoursTime}>
                    {restaurant.openingHours[day]}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.reviewSection}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => setShowReviewForm(!showReviewForm)}
            >
              <Send size={14} color={Colors.white} />
              <Text style={styles.writeReviewText}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {showReviewForm && (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewFormLabel}>Your Rating</Text>
              <StarRating
                rating={reviewRating}
                onRate={setReviewRating}
                size={32}
              />
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor={Colors.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="review-input"
              />
              <Animated.View
                style={{ transform: [{ scale: submitScale }] }}
              >
                <TouchableOpacity
                  style={styles.submitReviewBtn}
                  onPress={handleSubmitReview}
                  testID="submit-review"
                >
                  <Text style={styles.submitReviewText}>Submit Review</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {reviews.length === 0 ? (
            <View style={styles.noReviews}>
              <Text style={styles.noReviewsText}>
                No reviews yet. Be the first!
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <View style={styles.reviewerAvatar}>
                    <Text style={styles.reviewerInitial}>
                      {review.userName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>{review.userName}</Text>
                    <Text style={styles.reviewDate}>{review.createdAt}</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    <Star
                      size={12}
                      color={Colors.star}
                      fill={Colors.star}
                    />
                    <Text style={styles.reviewStarText}>{review.rating}</Text>
                  </View>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))
          )}
        </View>
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
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: "600" as const,
  },
  heroContainer: {
    height: 280,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  heroBackButton: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: "600" as const,
  },
  photoStrip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  photoThumbActive: {
    borderColor: Colors.primary,
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.star,
  },
  reviewCount: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: Colors.white,
    flex: 1,
  },
  hoursToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hoursGrid: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hoursDay: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    width: 40,
  },
  hoursTime: {
    fontSize: 13,
    color: Colors.white,
  },
  reviewSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  writeReviewText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  reviewForm: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewFormLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  reviewInput: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.white,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  submitReviewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitReviewText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  noReviews: {
    padding: 24,
    alignItems: "center",
  },
  noReviewsText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  reviewerInitial: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  reviewDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewStarText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.star,
  },
  reviewComment: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  mapLinkRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapLinkLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  mapLinkBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapLinkBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});
