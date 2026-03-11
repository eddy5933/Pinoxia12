import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import createContextHook from "@nkzw/create-context-hook";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface FriendLocation {
  userId: string;
  name: string;
  avatar?: string;
  latitude: number;
  longitude: number;
  placeName?: string;
  updatedAt: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    if (Platform.OS !== "web") {
      const Location = require("expo-location") as typeof import("expo-location");
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const addr = results[0];
        const parts: string[] = [];
        if (addr.name && addr.name !== addr.street) parts.push(addr.name);
        if (addr.street) parts.push(addr.street);
        if (addr.city) parts.push(addr.city);
        if (addr.region && addr.region !== addr.city) parts.push(addr.region);
        const placeName = parts.length > 0 ? parts.join(", ") : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        console.log("[LocationProvider] Reverse geocoded:", placeName);
        return placeName;
      }
    } else {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
        { headers: { "User-Agent": "FoodSpotApp/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const short = data.display_name.split(",").slice(0, 3).join(",").trim();
          console.log("[LocationProvider] Web reverse geocoded:", short);
          return short;
        }
      }
    }
  } catch (err) {
    console.log("[LocationProvider] Reverse geocoding failed:", err);
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const shareIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestLocation = useCallback(async () => {
    console.log("[LocationProvider] Requesting user location...");
    setLocationLoading(true);
    setLocationError(null);

    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          const getWebLocation = (highAccuracy: boolean): Promise<GeolocationPosition> =>
            new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: highAccuracy,
                timeout: 20000,
                maximumAge: 120000,
              });
            });

          try {
            const position = await getWebLocation(true);
            console.log("[LocationProvider] Web high-accuracy location obtained:", position.coords);
            const placeName = await reverseGeocode(position.coords.latitude, position.coords.longitude);
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              placeName,
            });
          } catch (highAccError) {
            console.log("[LocationProvider] High-accuracy failed, trying low accuracy...", highAccError);
            try {
              const position = await getWebLocation(false);
              console.log("[LocationProvider] Web low-accuracy location obtained:", position.coords);
              const placeNameLow = await reverseGeocode(position.coords.latitude, position.coords.longitude);
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                placeName: placeNameLow,
              });
            } catch (lowAccError) {
              console.log("[LocationProvider] Web geolocation error:", lowAccError);
              setLocationError("Location access denied. Please enable location in browser settings.");
            }
          }
          setLocationLoading(false);
        } else {
          setLocationError("Geolocation not supported in this browser");
          setLocationLoading(false);
        }
      } else {
        const Location = require("expo-location") as typeof import("expo-location");

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        console.log("[LocationProvider] Location services enabled:", servicesEnabled);
        if (!servicesEnabled) {
          setLocationError("Please enable GPS/Location Services in your device settings");
          setLocationLoading(false);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log("[LocationProvider] Permission status:", status);
        if (status !== "granted") {
          setLocationError("Location permission denied. Please allow location access in Settings.");
          setLocationLoading(false);
          return;
        }

        let loc: import("expo-location").LocationObject | null = null;

        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            console.log("[LocationProvider] Using last known position:", lastKnown.coords);
            const lastPlaceName = await reverseGeocode(lastKnown.coords.latitude, lastKnown.coords.longitude);
            setUserLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              placeName: lastPlaceName,
            });
          }
        } catch (lastErr) {
          console.log("[LocationProvider] getLastKnownPosition failed:", lastErr);
        }

        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
          });
          console.log("[LocationProvider] High accuracy location obtained:", loc.coords);
        } catch (highErr) {
          console.log("[LocationProvider] High accuracy failed, trying balanced...", highErr);
          try {
            loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            console.log("[LocationProvider] Balanced accuracy location obtained:", loc.coords);
          } catch (balErr) {
            console.log("[LocationProvider] Balanced accuracy failed, trying low...", balErr);
            loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
            console.log("[LocationProvider] Low accuracy location obtained:", loc.coords);
          }
        }

        if (loc) {
          const nativePlaceName = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            placeName: nativePlaceName,
          });
        }
        setLocationLoading(false);
      }
    } catch (err) {
      console.log("[LocationProvider] Location error:", err);
      setLocationError("Could not get location. Please check GPS is enabled and try again.");
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  const shareLocationToSupabase = useCallback(async (loc: UserLocation, userId: string, sharing: boolean) => {
    try {
      console.log("[LocationProvider] Sharing location to Supabase for user:", userId, "enabled:", sharing, "coords:", loc.latitude, loc.longitude);
      const { data, error } = await supabase
        .from("profiles")
        .update({
          latitude: loc.latitude,
          longitude: loc.longitude,
          location_place_name: loc.placeName ?? null,
          location_updated_at: new Date().toISOString(),
          location_sharing_enabled: sharing,
        })
        .eq("id", userId)
        .select();
      if (error) {
        console.warn("[LocationProvider] Failed to share location:", error.message, error.details, error.hint, error.code);
      } else {
        console.log("[LocationProvider] Location shared successfully, updated rows:", data?.length ?? 0);
      }
    } catch (err) {
      console.warn("[LocationProvider] Share location error:", err);
    }
  }, []);

  const setLocationUser = useCallback((userId: string) => {
    console.log("[LocationProvider] Setting current user for location sharing:", userId);
    setCurrentUserId(userId);
  }, []);

  useEffect(() => {
    if (!currentUserId || !userLocation) return;

    if (sharingEnabled) {
      void shareLocationToSupabase(userLocation, currentUserId, true);
    } else {
      void supabase
        .from("profiles")
        .update({ location_sharing_enabled: false })
        .eq("id", currentUserId)
        .then(({ error }) => {
          if (error) console.warn("[LocationProvider] Failed to disable sharing:", error.message);
          else console.log("[LocationProvider] Location sharing disabled in DB");
        });
    }

    if (shareIntervalRef.current) {
      clearInterval(shareIntervalRef.current);
    }
    if (sharingEnabled) {
      shareIntervalRef.current = setInterval(() => {
        if (userLocation && currentUserId && sharingEnabled) {
          void shareLocationToSupabase(userLocation, currentUserId, true);
        }
      }, 30000);
    }

    return () => {
      if (shareIntervalRef.current) {
        clearInterval(shareIntervalRef.current);
      }
    };
  }, [currentUserId, userLocation, sharingEnabled, shareLocationToSupabase]);

  const friendLocationsQuery = useQuery({
    queryKey: ["friend_locations", currentUserId],
    queryFn: async (): Promise<FriendLocation[]> => {
      if (!currentUserId) {
        console.log("[LocationProvider] No currentUserId, skipping friend locations");
        return [];
      }
      console.log("[LocationProvider] Fetching friends locations for user:", currentUserId);

      const { data: friendRows, error: fErr } = await supabase
        .from("friends")
        .select("friend_id, is_close_friend")
        .eq("user_id", currentUserId);

      console.log("[LocationProvider] Friends query result:", {
        count: friendRows?.length ?? 0,
        error: fErr?.message ?? null,
        rows: friendRows?.map((f: any) => ({ friend_id: f.friend_id, is_close_friend: f.is_close_friend })),
      });

      if (fErr) {
        console.warn("[LocationProvider] Friends query error:", fErr.message, fErr.details, fErr.hint);
        return [];
      }
      if (!friendRows || friendRows.length === 0) {
        console.log("[LocationProvider] No friends found");
        return [];
      }

      const closeFriendIds = friendRows
        .filter((f: any) => f.is_close_friend === true || f.is_close_friend === "true")
        .map((f: any) => f.friend_id);

      console.log("[LocationProvider] Close friend IDs:", closeFriendIds, "out of", friendRows.length, "total friends");

      if (closeFriendIds.length === 0) {
        console.log("[LocationProvider] No close friends set, skipping location fetch");
        return [];
      }

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name, avatar, latitude, longitude, location_place_name, location_updated_at, location_sharing_enabled")
        .in("id", closeFriendIds);

      console.log("[LocationProvider] Profiles query result:", {
        count: profiles?.length ?? 0,
        error: pErr?.message ?? null,
        profiles: profiles?.map((p: any) => ({
          id: p.id,
          name: p.name,
          lat: p.latitude,
          lng: p.longitude,
          sharing: p.location_sharing_enabled,
          updatedAt: p.location_updated_at,
        })),
      });

      if (pErr) {
        console.warn("[LocationProvider] Error fetching friend profiles:", pErr.message, pErr.details, pErr.hint);
        return [];
      }

      if (!profiles || profiles.length === 0) {
        console.log("[LocationProvider] No profiles found for close friend IDs. This may be an RLS issue.");
        return [];
      }

      const now = Date.now();
      const STALE_MS = 24 * 60 * 60 * 1000;
      const locations: FriendLocation[] = (profiles ?? [])
        .filter((p: any) => {
          const hasCoords = p.latitude != null && p.longitude != null;
          const sharingOn = p.location_sharing_enabled !== false;
          const isRecent = !p.location_updated_at || (now - new Date(p.location_updated_at).getTime()) < STALE_MS;

          console.log("[LocationProvider] Filter check for", p.name, ":", {
            hasCoords,
            sharingOn,
            isRecent,
            lat: p.latitude,
            lng: p.longitude,
            sharing: p.location_sharing_enabled,
            updatedAt: p.location_updated_at,
          });

          return hasCoords && sharingOn && isRecent;
        })
        .map((p: any) => ({
          userId: p.id,
          name: p.name ?? "Friend",
          avatar: p.avatar ?? undefined,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          placeName: p.location_place_name ?? undefined,
          updatedAt: p.location_updated_at ?? new Date().toISOString(),
        }));

      console.log("[LocationProvider] Final friend locations:", locations.length, "out of", profiles.length, "profiles");
      return locations;
    },
    enabled: !!currentUserId,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const friendLocations = useMemo(() => friendLocationsQuery.data ?? [], [friendLocationsQuery.data]);

  return useMemo(
    () => ({
      userLocation,
      locationLoading,
      locationError,
      requestLocation,
      setLocationUser,
      sharingEnabled,
      setSharingEnabled,
      friendLocations,
      friendLocationsLoading: friendLocationsQuery.isLoading,
    }),
    [userLocation, locationLoading, locationError, requestLocation, setLocationUser, sharingEnabled, friendLocations, friendLocationsQuery.isLoading]
  );
});

export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}
