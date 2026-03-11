import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Restaurant, Review } from "@/types";
import { MOCK_RESTAURANTS, MOCK_REVIEWS } from "@/mocks/restaurants";

const RESTAURANTS_KEY = "foodspot_restaurants";
const REVIEWS_KEY = "foodspot_reviews";
const INITIALIZED_KEY = "foodspot_initialized";

export const [RestaurantProvider, useRestaurants] = createContextHook(() => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReady, setIsReady] = useState(false);

  const loadQuery = useQuery({
    queryKey: ["restaurants_load"],
    queryFn: async () => {
      console.log("[RestaurantProvider] Loading data from AsyncStorage...");
      const [storedRestaurants, storedReviews, initialized] = await Promise.all([
        AsyncStorage.getItem(RESTAURANTS_KEY),
        AsyncStorage.getItem(REVIEWS_KEY),
        AsyncStorage.getItem(INITIALIZED_KEY),
      ]);

      let loadedRestaurants: Restaurant[];
      let loadedReviews: Review[];

      if (initialized && storedRestaurants && storedReviews) {
        loadedRestaurants = JSON.parse(storedRestaurants) as Restaurant[];
        loadedReviews = JSON.parse(storedReviews) as Review[];
        console.log("[RestaurantProvider] Loaded from storage:", loadedRestaurants.length, "restaurants,", loadedReviews.length, "reviews");
      } else {
        loadedRestaurants = MOCK_RESTAURANTS;
        loadedReviews = MOCK_REVIEWS;
        await Promise.all([
          AsyncStorage.setItem(RESTAURANTS_KEY, JSON.stringify(loadedRestaurants)),
          AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(loadedReviews)),
          AsyncStorage.setItem(INITIALIZED_KEY, "true"),
        ]);
        console.log("[RestaurantProvider] Initialized with mock data");
      }

      return { restaurants: loadedRestaurants, reviews: loadedReviews };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setRestaurants(loadQuery.data.restaurants);
      setReviews(loadQuery.data.reviews);
      setIsReady(true);
    }
  }, [loadQuery.data]);

  const persistRestaurants = useMutation({
    mutationFn: async (updated: Restaurant[]) => {
      await AsyncStorage.setItem(RESTAURANTS_KEY, JSON.stringify(updated));
      console.log("[RestaurantProvider] Persisted", updated.length, "restaurants");
    },
  });

  const persistReviews = useMutation({
    mutationFn: async (updated: Review[]) => {
      await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(updated));
      console.log("[RestaurantProvider] Persisted", updated.length, "reviews");
    },
  });

  const updateRestaurant = useCallback((id: string, updates: Partial<Omit<Restaurant, "id" | "rating" | "reviewCount" | "createdAt" | "ownerId">>) => {
    setRestaurants((prev) => {
      const updated = prev.map((r) => {
        if (r.id === id) {
          return { ...r, ...updates };
        }
        return r;
      });
      persistRestaurants.mutate(updated);
      return updated;
    });
    console.log("[RestaurantProvider] Updated restaurant:", id);
  }, [persistRestaurants]);

  const addRestaurant = useCallback((restaurant: Omit<Restaurant, "id" | "rating" | "reviewCount" | "createdAt">) => {
    const newRestaurant: Restaurant = {
      ...restaurant,
      id: `r_${Date.now()}`,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setRestaurants((prev) => {
      const updated = [newRestaurant, ...prev];
      persistRestaurants.mutate(updated);
      return updated;
    });
    console.log("[RestaurantProvider] Added restaurant:", newRestaurant.name);
    return newRestaurant;
  }, [persistRestaurants]);

  const addReview = useCallback((review: Omit<Review, "id" | "createdAt">) => {
    const newReview: Review = {
      ...review,
      id: `rev_${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setReviews((prev) => {
      const updated = [newReview, ...prev];
      persistReviews.mutate(updated);
      return updated;
    });
    setRestaurants((prev) => {
      const updated = prev.map((r) => {
        if (r.id === review.restaurantId) {
          const currentReviewCount = r.reviewCount;
          const newAvg = (r.rating * currentReviewCount + review.rating) / (currentReviewCount + 1);
          return {
            ...r,
            rating: Math.round(newAvg * 10) / 10,
            reviewCount: currentReviewCount + 1,
          };
        }
        return r;
      });
      persistRestaurants.mutate(updated);
      return updated;
    });
    console.log("[RestaurantProvider] Added review for restaurant:", review.restaurantId);
    return newReview;
  }, [persistRestaurants, persistReviews]);

  const getReviewsForRestaurant = useCallback(
    (restaurantId: string) => reviews.filter((r) => r.restaurantId === restaurantId),
    [reviews]
  );

  const deleteRestaurant = useCallback((id: string) => {
    setRestaurants((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistRestaurants.mutate(updated);
      return updated;
    });
    setReviews((prev) => {
      const updated = prev.filter((r) => r.restaurantId !== id);
      persistReviews.mutate(updated);
      return updated;
    });
    console.log("[RestaurantProvider] Deleted restaurant:", id);
  }, [persistRestaurants, persistReviews]);

  const getRestaurantsByOwner = useCallback(
    (ownerId: string) => restaurants.filter((r) => r.ownerId === ownerId),
    [restaurants]
  );

  return useMemo(
    () => ({
      restaurants,
      reviews,
      isReady,
      addRestaurant,
      updateRestaurant,
      deleteRestaurant,
      addReview,
      getReviewsForRestaurant,
      getRestaurantsByOwner,
    }),
    [restaurants, reviews, isReady, addRestaurant, updateRestaurant, deleteRestaurant, addReview, getReviewsForRestaurant, getRestaurantsByOwner]
  );
});

export function useFilteredRestaurants(search: string, cuisine: string) {
  const { restaurants } = useRestaurants();
  return useMemo(() => {
    let filtered = restaurants;
    if (cuisine && cuisine !== "All") {
      filtered = filtered.filter((r) => r.cuisine === cuisine);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine?.toLowerCase().includes(q) ?? false) ||
          r.address.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [restaurants, search, cuisine]);
}
