import { useState, useCallback, useMemo } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { Restaurant, Review } from "@/types";
import { MOCK_RESTAURANTS, MOCK_REVIEWS } from "@/mocks/restaurants";

export const [RestaurantProvider, useRestaurants] = createContextHook(() => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(MOCK_RESTAURANTS);
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);

  const addRestaurant = useCallback((restaurant: Omit<Restaurant, "id" | "rating" | "reviewCount" | "createdAt">) => {
    const newRestaurant: Restaurant = {
      ...restaurant,
      id: `r_${Date.now()}`,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setRestaurants((prev) => [newRestaurant, ...prev]);
    return newRestaurant;
  }, []);

  const addReview = useCallback((review: Omit<Review, "id" | "createdAt">) => {
    const newReview: Review = {
      ...review,
      id: `rev_${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setReviews((prev) => [newReview, ...prev]);
    setRestaurants((prev) =>
      prev.map((r) => {
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
      })
    );
    return newReview;
  }, []);

  const getReviewsForRestaurant = useCallback(
    (restaurantId: string) => reviews.filter((r) => r.restaurantId === restaurantId),
    [reviews]
  );

  const getRestaurantsByOwner = useCallback(
    (ownerId: string) => restaurants.filter((r) => r.ownerId === ownerId),
    [restaurants]
  );

  return useMemo(
    () => ({
      restaurants,
      reviews,
      addRestaurant,
      addReview,
      getReviewsForRestaurant,
      getRestaurantsByOwner,
    }),
    [restaurants, reviews, addRestaurant, addReview, getReviewsForRestaurant, getRestaurantsByOwner]
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
          r.cuisine.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [restaurants, search, cuisine]);
}
