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
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          } catch (highAccError) {
            console.log("[LocationProvider] High-accuracy failed, trying low accuracy...", highAccError);
            try {
              const position = await getWebLocation(false);
              console.log("[LocationProvider] Web low-accuracy location obtained:", position.coords);
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
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
            setUserLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
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
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
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
