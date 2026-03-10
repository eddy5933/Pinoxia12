import { useState, useCallback, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import createContextHook from "@nkzw/create-context-hook";

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    console.log("[LocationProvider] Requesting user location...");
    setLocationLoading(true);
    setLocationError(null);

    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("[LocationProvider] Web location obtained:", position.coords);
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              setLocationLoading(false);
            },
            (error) => {
              console.log("[LocationProvider] Web geolocation error:", error.message);
              setLocationError("Location access denied");
              setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
          );
        } else {
          setLocationError("Geolocation not supported");
          setLocationLoading(false);
        }
      } else {
        const Location = require("expo-location") as typeof import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[LocationProvider] Location permission denied");
          setLocationError("Location permission denied");
          setLocationLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        console.log("[LocationProvider] Native location obtained:", loc.coords);
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        setLocationLoading(false);
      }
    } catch (err) {
      console.log("[LocationProvider] Location error:", err);
      setLocationError("Could not get location");
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  return useMemo(
    () => ({
      userLocation,
      locationLoading,
      locationError,
      requestLocation,
    }),
    [userLocation, locationLoading, locationError, requestLocation]
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
