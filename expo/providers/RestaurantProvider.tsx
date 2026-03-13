import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery } from "@tanstack/react-query";
import { Restaurant, Review } from "@/types";
import { MOCK_RESTAURANTS, MOCK_REVIEWS, MOCK_MALAYSIA_REVIEWS } from "@/mocks/restaurants";
import { ALL_QATAR_PLACES } from "@/mocks/qatar-places";
import { supabase } from "@/lib/supabase";

export const [RestaurantProvider, useRestaurants] = createContextHook(() => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReady, setIsReady] = useState(false);

  const loadQuery = useQuery({
    queryKey: ["restaurants_load"],
    queryFn: async () => {
      console.log("[RestaurantProvider] Loading data from Supabase...");
      try {
        const [restRes, revRes] = await Promise.all([
          supabase.from("restaurants").select("*"),
          supabase.from("reviews").select("*").order("created_at", { ascending: false }),
        ]);

        if (restRes.error) {
          console.warn("[RestaurantProvider] Supabase restaurants error:", restRes.error.message);
          console.log("[RestaurantProvider] Falling back to mock data (", MOCK_RESTAURANTS.length, "restaurants)");
          return { restaurants: [...MOCK_RESTAURANTS, ...ALL_QATAR_PLACES], reviews: MOCK_REVIEWS };
        }

        let loadedRestaurants: Restaurant[] = (restRes.data ?? []).map((r: any) => ({
          id: r.id,
          ownerId: r.owner_id,
          name: r.name,
          description: r.description,
          cuisine: r.cuisine ?? undefined,
          photos: r.photos ?? [],
          address: r.address,
          latitude: r.latitude,
          longitude: r.longitude,
          openingHours: r.opening_hours ?? {
            monday: "", tuesday: "", wednesday: "", thursday: "",
            friday: "", saturday: "", sunday: "",
          },
          phone: r.phone ?? undefined,
          rating: r.rating ?? 0,
          reviewCount: r.review_count ?? 0,
          priceRange: r.price_range ?? "$",
          createdAt: r.created_at,
        }));

        let loadedReviews: Review[] = (revRes.data ?? []).map((rv: any) => ({
          id: rv.id,
          restaurantId: rv.restaurant_id,
          userId: rv.user_id,
          userName: rv.user_name,
          rating: rv.rating,
          comment: rv.comment,
          createdAt: rv.created_at,
        }));

        if (loadedRestaurants.length === 0) {
          console.log("[RestaurantProvider] No restaurants found in Supabase, seeding all mock data...");
          const allPlaces = [...MOCK_RESTAURANTS, ...ALL_QATAR_PLACES];
          const inserts = allPlaces.map((r) => ({
            id: r.id,
            owner_id: r.ownerId,
            name: r.name,
            description: r.description,
            cuisine: r.cuisine ?? null,
            photos: r.photos,
            address: r.address,
            latitude: r.latitude,
            longitude: r.longitude,
            opening_hours: r.openingHours,
            phone: r.phone ?? null,
            rating: r.rating,
            review_count: r.reviewCount,
            price_range: r.priceRange ?? null,
          }));
          const { error: seedError } = await supabase.from("restaurants").insert(inserts);
          if (seedError) {
            console.warn("[RestaurantProvider] Seed error:", seedError.message, "- using mock data directly");
          }
          loadedRestaurants = allPlaces;

          const allReviews = [...MOCK_REVIEWS, ...MOCK_MALAYSIA_REVIEWS];
          const reviewInserts = allReviews.map((rv) => ({
            id: rv.id,
            restaurant_id: rv.restaurantId,
            user_id: rv.userId,
            user_name: rv.userName,
            rating: rv.rating,
            comment: rv.comment,
          }));
          const { error: revSeedError } = await supabase.from("reviews").insert(reviewInserts);
          if (revSeedError) {
            console.warn("[RestaurantProvider] Review seed error:", revSeedError.message);
          }
          loadedReviews = allReviews;
        } else {
          const hasQatarPlaces = loadedRestaurants.some((r) => r.id.startsWith("qa-"));
          if (!hasQatarPlaces) {
            console.log("[RestaurantProvider] Qatar places not found in Supabase, seeding...");
            const qatarInserts = ALL_QATAR_PLACES.map((r) => ({
              id: r.id,
              owner_id: r.ownerId,
              name: r.name,
              description: r.description,
              cuisine: r.cuisine ?? null,
              photos: r.photos,
              address: r.address,
              latitude: r.latitude,
              longitude: r.longitude,
              opening_hours: r.openingHours,
              phone: r.phone ?? null,
              rating: r.rating,
              review_count: r.reviewCount,
              price_range: r.priceRange ?? null,
            }));
            const { error: qaSeedErr } = await supabase.from("restaurants").insert(qatarInserts);
            if (qaSeedErr) {
              console.warn("[RestaurantProvider] Qatar places seed error:", qaSeedErr.message);
            } else {
              console.log("[RestaurantProvider] Seeded", ALL_QATAR_PLACES.length, "Qatar places");
            }
            loadedRestaurants = [...loadedRestaurants, ...ALL_QATAR_PLACES];
          }

          const hasMalaysia = loadedRestaurants.some((r) => r.id.startsWith("my-"));
          if (!hasMalaysia) {
            console.log("[RestaurantProvider] Malaysia places not found in Supabase, seeding...");
            const malaysiaPlaces = MOCK_RESTAURANTS.filter((r) => r.id.startsWith("my-"));
            const myInserts = malaysiaPlaces.map((r) => ({
              id: r.id,
              owner_id: r.ownerId,
              name: r.name,
              description: r.description,
              cuisine: r.cuisine ?? null,
              photos: r.photos,
              address: r.address,
              latitude: r.latitude,
              longitude: r.longitude,
              opening_hours: r.openingHours,
              phone: r.phone ?? null,
              rating: r.rating,
              review_count: r.reviewCount,
              price_range: r.priceRange,
            }));
            const { error: mySeedErr } = await supabase.from("restaurants").insert(myInserts);
            if (mySeedErr) {
              console.warn("[RestaurantProvider] Malaysia seed error:", mySeedErr.message);
            } else {
              console.log("[RestaurantProvider] Seeded", malaysiaPlaces.length, "Malaysia places");
            }
            loadedRestaurants = [...loadedRestaurants, ...malaysiaPlaces];

            const myRevInserts = MOCK_MALAYSIA_REVIEWS.map((rv) => ({
              id: rv.id,
              restaurant_id: rv.restaurantId,
              user_id: rv.userId,
              user_name: rv.userName,
              rating: rv.rating,
              comment: rv.comment,
            }));
            const { error: myRevErr } = await supabase.from("reviews").insert(myRevInserts);
            if (myRevErr) {
              console.warn("[RestaurantProvider] Malaysia reviews seed error:", myRevErr.message);
            }
            loadedReviews = [...loadedReviews, ...MOCK_MALAYSIA_REVIEWS];
          }
        }

        console.log("[RestaurantProvider] Loaded", loadedRestaurants.length, "restaurants,", loadedReviews.length, "reviews");
        return { restaurants: loadedRestaurants, reviews: loadedReviews };
      } catch (err) {
        console.warn("[RestaurantProvider] Network/Supabase error, falling back to mock data:", err);
        return { restaurants: [...MOCK_RESTAURANTS, ...ALL_QATAR_PLACES], reviews: MOCK_REVIEWS };
      }
    },
    staleTime: 10000,
    retry: 1,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setRestaurants(loadQuery.data.restaurants);
      setReviews(loadQuery.data.reviews);
      setIsReady(true);
    }
  }, [loadQuery.data]);

  const updateRestaurant = useCallback(async (id: string, updates: Partial<Omit<Restaurant, "id" | "rating" | "reviewCount" | "createdAt" | "ownerId">>) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.cuisine !== undefined) dbUpdates.cuisine = updates.cuisine;
    if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.openingHours !== undefined) dbUpdates.opening_hours = updates.openingHours;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.priceRange !== undefined) dbUpdates.price_range = updates.priceRange;

    const { error } = await supabase.from("restaurants").update(dbUpdates).eq("id", id);
    if (error) {
      console.warn("[RestaurantProvider] Update error:", error.message);
    }

    setRestaurants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    console.log("[RestaurantProvider] Updated restaurant:", id);
  }, []);

  const addRestaurant = useCallback(async (restaurant: Omit<Restaurant, "id" | "rating" | "reviewCount" | "createdAt">) => {
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        owner_id: restaurant.ownerId,
        name: restaurant.name,
        description: restaurant.description,
        cuisine: restaurant.cuisine ?? null,
        photos: restaurant.photos,
        address: restaurant.address,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        opening_hours: restaurant.openingHours,
        phone: restaurant.phone ?? null,
        rating: 0,
        review_count: 0,
        price_range: restaurant.priceRange,
      })
      .select()
      .single();

    if (error) {
      console.warn("[RestaurantProvider] Add error:", error.message);
      const fallback: Restaurant = {
        ...restaurant,
        id: `r_${Date.now()}`,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };
      setRestaurants((prev) => [fallback, ...prev]);
      return fallback;
    }

    const newRestaurant: Restaurant = {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      description: data.description,
      cuisine: data.cuisine ?? undefined,
      photos: data.photos ?? [],
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      openingHours: data.opening_hours,
      phone: data.phone ?? undefined,
      rating: 0,
      reviewCount: 0,
      priceRange: data.price_range,
      createdAt: data.created_at,
    };
    setRestaurants((prev) => [newRestaurant, ...prev]);
    console.log("[RestaurantProvider] Added restaurant:", newRestaurant.name);
    return newRestaurant;
  }, []);

  const addReview = useCallback(async (review: Omit<Review, "id" | "createdAt">) => {
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        restaurant_id: review.restaurantId,
        user_id: review.userId,
        user_name: review.userName,
        rating: review.rating,
        comment: review.comment,
      })
      .select()
      .single();

    const newReview: Review = data
      ? {
          id: data.id,
          restaurantId: data.restaurant_id,
          userId: data.user_id,
          userName: data.user_name,
          rating: data.rating,
          comment: data.comment,
          createdAt: data.created_at,
        }
      : {
          ...review,
          id: `rev_${Date.now()}`,
          createdAt: new Date().toISOString(),
        };

    if (error) {
      console.warn("[RestaurantProvider] Add review error:", error.message);
    }

    setReviews((prev) => [newReview, ...prev]);

    setRestaurants((prev) => {
      const updated = prev.map((r) => {
        if (r.id === review.restaurantId) {
          const newCount = r.reviewCount + 1;
          const newAvg = (r.rating * r.reviewCount + review.rating) / newCount;
          const updatedR = {
            ...r,
            rating: Math.round(newAvg * 10) / 10,
            reviewCount: newCount,
          };

          supabase
            .from("restaurants")
            .update({ rating: updatedR.rating, review_count: updatedR.reviewCount })
            .eq("id", r.id)
            .then(({ error: upErr }) => {
              if (upErr) console.warn("[RestaurantProvider] Rating update error:", upErr.message);
            });

          return updatedR;
        }
        return r;
      });
      return updated;
    });

    console.log("[RestaurantProvider] Added review for restaurant:", review.restaurantId);
    return newReview;
  }, []);

  const getReviewsForRestaurant = useCallback(
    (restaurantId: string) => reviews.filter((r) => r.restaurantId === restaurantId),
    [reviews]
  );

  const deleteRestaurant = useCallback(async (id: string) => {
    await supabase.from("reviews").delete().eq("restaurant_id", id);
    await supabase.from("restaurants").delete().eq("id", id);
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
    setReviews((prev) => prev.filter((r) => r.restaurantId !== id));
    console.log("[RestaurantProvider] Deleted restaurant:", id);
  }, []);

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
