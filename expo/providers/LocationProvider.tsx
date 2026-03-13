import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Alert, Linking, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
  setBackgroundUserId,
} from "@/lib/backgroundLocation";

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

export type LiveLocationDuration = 15 | 30 | 60 | 120 | 'always' | null;

const LIVE_LOC_STORAGE_KEY = 'pinoxia_live_location';
const BG_PERM_STORAGE_KEY = 'pinoxia_bg_location_granted';

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [closeFriendSharingEnabled, setCloseFriendSharingEnabled] = useState(true);
  const [familySharingEnabled, setFamilySharingEnabled] = useState(true);
  const shareIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [liveLocationActive, setLiveLocationActive] = useState(false);
  const [liveLocationDuration, setLiveLocationDuration] = useState<LiveLocationDuration>(null);
  const [liveLocationEndTime, setLiveLocationEndTime] = useState<number | null>(null);
  const [liveLocationRemainingLabel, setLiveLocationRemainingLabel] = useState<string | null>(null);
  const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState(false);
  const liveLocationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveLocationRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const locationRefreshInterval = setInterval(() => {
      console.log("[LocationProvider] Periodic location refresh triggered");
      void requestLocation();
    }, 15000);

    return () => {
      clearInterval(locationRefreshInterval);
    };
  }, [requestLocation]);

  useEffect(() => {
    const loadLiveLocationState = async () => {
      try {
        const stored = await AsyncStorage.getItem(LIVE_LOC_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('[LocationProvider] Restored live location state:', parsed);
          if (parsed.duration === 'always') {
            setLiveLocationActive(true);
            setLiveLocationDuration('always');
            setLiveLocationEndTime(null);
            void startBackgroundLocationUpdates();
          } else if (parsed.endTime && parsed.endTime > Date.now()) {
            setLiveLocationActive(true);
            setLiveLocationDuration(parsed.duration);
            setLiveLocationEndTime(parsed.endTime);
            void startBackgroundLocationUpdates();
          } else {
            await AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
            await stopBackgroundLocationUpdates();
          }
        }
        const bgPerm = await AsyncStorage.getItem(BG_PERM_STORAGE_KEY);
        if (bgPerm === 'true') {
          if (Platform.OS !== 'web') {
            try {
              const Location = require('expo-location') as typeof import('expo-location');
              const { status } = await Location.getBackgroundPermissionsAsync();
              if (status === 'granted') {
                setBackgroundPermissionGranted(true);
              } else {
                console.log('[LocationProvider] Stored bg perm but actual permission revoked');
                setBackgroundPermissionGranted(false);
                await AsyncStorage.removeItem(BG_PERM_STORAGE_KEY);
              }
            } catch (e) {
              console.log('[LocationProvider] Error checking bg perm on load:', e);
              setBackgroundPermissionGranted(true);
            }
          }
        }
      } catch (err) {
        console.log('[LocationProvider] Failed to restore live location state:', err);
      }
    };
    void loadLiveLocationState();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkPermissionOnResume = async () => {
      try {
        const Location = require('expo-location') as typeof import('expo-location');
        const { status } = await Location.getBackgroundPermissionsAsync();
        console.log('[LocationProvider] AppState resume bg permission check:', status);
        if (status === 'granted') {
          if (!backgroundPermissionGranted) {
            setBackgroundPermissionGranted(true);
            await AsyncStorage.setItem(BG_PERM_STORAGE_KEY, 'true');
          }
        } else {
          if (backgroundPermissionGranted) {
            setBackgroundPermissionGranted(false);
            await AsyncStorage.removeItem(BG_PERM_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.log('[LocationProvider] AppState permission check error:', e);
      }
    };
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkPermissionOnResume();
      }
    });
    return () => sub.remove();
  }, [backgroundPermissionGranted]);

  useEffect(() => {
    if (!liveLocationActive) {
      if (liveLocationTimerRef.current) {
        clearInterval(liveLocationTimerRef.current);
        liveLocationTimerRef.current = null;
      }
      if (liveLocationRefreshRef.current) {
        clearInterval(liveLocationRefreshRef.current);
        liveLocationRefreshRef.current = null;
      }
      setLiveLocationRemainingLabel(null);
      return;
    }

    if (liveLocationDuration !== 'always' && liveLocationEndTime) {
      const updateRemaining = () => {
        const remaining = liveLocationEndTime - Date.now();
        if (remaining <= 0) {
          console.log('[LocationProvider] Live location timer expired');
          setLiveLocationActive(false);
          setLiveLocationDuration(null);
          setLiveLocationEndTime(null);
          setLiveLocationRemainingLabel(null);
          void AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
          void stopBackgroundLocationUpdates();
          return;
        }
        const mins = Math.ceil(remaining / 60000);
        if (mins >= 60) {
          const hrs = Math.floor(mins / 60);
          const m = mins % 60;
          setLiveLocationRemainingLabel(`${hrs}h ${m}m remaining`);
        } else {
          setLiveLocationRemainingLabel(`${mins}m remaining`);
        }
      };
      updateRemaining();
      liveLocationTimerRef.current = setInterval(updateRemaining, 30000);
    } else if (liveLocationDuration === 'always') {
      setLiveLocationRemainingLabel('Always on');
    }

    liveLocationRefreshRef.current = setInterval(() => {
      console.log('[LocationProvider] Live location fast refresh');
      void requestLocation();
    }, 5000);

    return () => {
      if (liveLocationTimerRef.current) {
        clearInterval(liveLocationTimerRef.current);
        liveLocationTimerRef.current = null;
      }
      if (liveLocationRefreshRef.current) {
        clearInterval(liveLocationRefreshRef.current);
        liveLocationRefreshRef.current = null;
      }
    };
  }, [liveLocationActive, liveLocationDuration, liveLocationEndTime, requestLocation]);

  const requestBackgroundPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[LocationProvider] Background location not supported on web');
      return false;
    }
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.log('[LocationProvider] Foreground permission denied, cannot request background');
        Alert.alert('Permission Required', 'Please allow foreground location access first.');
        return false;
      }

      const bgPerm = await Location.getBackgroundPermissionsAsync();
      console.log('[LocationProvider] Current background permission:', bgPerm.status, 'canAskAgain:', bgPerm.canAskAgain);

      if (bgPerm.status === 'granted') {
        setBackgroundPermissionGranted(true);
        await AsyncStorage.setItem(BG_PERM_STORAGE_KEY, 'true');
        return true;
      }

      if (bgPerm.canAskAgain) {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        console.log('[LocationProvider] Background permission result:', status);
        if (status === 'granted') {
          setBackgroundPermissionGranted(true);
          await AsyncStorage.setItem(BG_PERM_STORAGE_KEY, 'true');
          return true;
        }
      }

      Alert.alert(
        'Background Location',
        Platform.OS === 'ios'
          ? 'To enable GPS, go to Settings > Privacy > Location Services > Pinoxia and select "Always".'
          : 'To enable GPS, go to Settings > Apps > Pinoxia > Permissions > Location and select "Allow all the time".',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      console.log('[LocationProvider] Background permission error:', err);
      return false;
    }
  }, []);

  const disableBackgroundGps = useCallback(async () => {
    console.log('[LocationProvider] Disabling background GPS');
    setBackgroundPermissionGranted(false);
    await AsyncStorage.removeItem(BG_PERM_STORAGE_KEY);
    await stopBackgroundLocationUpdates();
    if (liveLocationActive) {
      setLiveLocationActive(false);
      setLiveLocationDuration(null);
      setLiveLocationEndTime(null);
      setLiveLocationRemainingLabel(null);
      await AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
    }
  }, [liveLocationActive]);

  const toggleBackgroundGps = useCallback(async () => {
    console.log('[LocationProvider] Toggle GPS, current state:', backgroundPermissionGranted);
    if (backgroundPermissionGranted) {
      await disableBackgroundGps();
    } else {
      const granted = await requestBackgroundPermission();
      if (granted) {
        await startBackgroundLocationUpdates();
      }
    }
  }, [backgroundPermissionGranted, disableBackgroundGps, requestBackgroundPermission]);

  const startLiveLocation = useCallback(async (duration: LiveLocationDuration) => {
    if (!duration) return;
    console.log('[LocationProvider] Starting live location with duration:', duration);

    const bgGranted = await requestBackgroundPermission();
    console.log('[LocationProvider] Background permission for live location:', bgGranted);

    if (currentUserId) {
      await setBackgroundUserId(currentUserId);
    }

    setLiveLocationActive(true);
    setLiveLocationDuration(duration);

    if (duration === 'always') {
      setLiveLocationEndTime(null);
      await AsyncStorage.setItem(LIVE_LOC_STORAGE_KEY, JSON.stringify({ duration: 'always' }));
    } else {
      const endTime = Date.now() + duration * 60 * 1000;
      setLiveLocationEndTime(endTime);
      await AsyncStorage.setItem(LIVE_LOC_STORAGE_KEY, JSON.stringify({ duration, endTime }));
    }

    if (bgGranted) {
      const started = await startBackgroundLocationUpdates();
      console.log('[LocationProvider] Background location task started:', started);
    }

    void requestLocation();
  }, [requestBackgroundPermission, requestLocation, currentUserId]);

  const stopLiveLocation = useCallback(async () => {
    console.log('[LocationProvider] Stopping live location');
    setLiveLocationActive(false);
    setLiveLocationDuration(null);
    setLiveLocationEndTime(null);
    setLiveLocationRemainingLabel(null);
    await AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
    await stopBackgroundLocationUpdates();
  }, []);

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
    void setBackgroundUserId(userId);
  }, []);

  useEffect(() => {
    if (!currentUserId || !userLocation) return;

    if (sharingEnabled) {
      void shareLocationToSupabase(userLocation, currentUserId, true);
    } else {
      void supabase
        .from("profiles")
        .update({
          location_sharing_enabled: false,
          latitude: null,
          longitude: null,
          location_place_name: null,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", currentUserId)
        .then(({ error }) => {
          if (error) console.warn("[LocationProvider] Failed to disable sharing:", error.message);
          else console.log("[LocationProvider] Location sharing disabled and coordinates cleared in DB");
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

  useEffect(() => {
    if (!currentUserId) return;
    console.log("[LocationProvider] Updating close friend/family sharing flags:", { closeFriendSharingEnabled, familySharingEnabled });
    void supabase
      .from("profiles")
      .update({
        close_friend_location_sharing: closeFriendSharingEnabled,
        family_location_sharing: familySharingEnabled,
      })
      .eq("id", currentUserId)
      .then(({ error }) => {
        if (error) console.warn("[LocationProvider] Failed to update sharing flags:", error.message);
        else console.log("[LocationProvider] Sharing flags updated successfully");
      });
  }, [currentUserId, closeFriendSharingEnabled, familySharingEnabled]);

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
        .select("user_id, is_close_friend")
        .eq("friend_id", currentUserId);

      console.log("[LocationProvider] Users who added me as friend:", {
        count: friendRows?.length ?? 0,
        error: fErr?.message ?? null,
        rows: friendRows?.map((f: any) => ({ user_id: f.user_id, is_close_friend: f.is_close_friend })),
      });

      if (fErr) {
        console.warn("[LocationProvider] Friends query error:", fErr.message, fErr.details, fErr.hint);
        return [];
      }
      if (!friendRows || friendRows.length === 0) {
        console.log("[LocationProvider] No one added me as friend");
        return [];
      }

      const closeFriendIds = friendRows
        .filter((f: any) => f.is_close_friend === true || f.is_close_friend === "true")
        .map((f: any) => f.user_id);

      console.log("[LocationProvider] Users who marked me as close friend:", closeFriendIds, "out of", friendRows.length, "total");

      if (closeFriendIds.length === 0) {
        console.log("[LocationProvider] No one marked me as close friend, skipping location fetch");
        return [];
      }

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name, avatar, latitude, longitude, location_place_name, location_updated_at, location_sharing_enabled, close_friend_location_sharing")
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
          const closeFriendSharing = p.close_friend_location_sharing !== false;
          const isRecent = !p.location_updated_at || (now - new Date(p.location_updated_at).getTime()) < STALE_MS;

          console.log("[LocationProvider] Filter check for", p.name, ":", {
            hasCoords,
            sharingOn,
            closeFriendSharing,
            isRecent,
            lat: p.latitude,
            lng: p.longitude,
            sharing: p.location_sharing_enabled,
            updatedAt: p.location_updated_at,
          });

          return hasCoords && sharingOn && closeFriendSharing && isRecent;
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

  const familyLocationsQuery = useQuery({
    queryKey: ["family_locations", currentUserId],
    queryFn: async (): Promise<FriendLocation[]> => {
      if (!currentUserId) {
        console.log("[LocationProvider] No currentUserId, skipping family locations");
        return [];
      }
      console.log("[LocationProvider] Fetching family locations for user:", currentUserId);

      const { data: friendRows, error: fErr } = await supabase
        .from("friends")
        .select("user_id, is_family")
        .eq("friend_id", currentUserId);

      if (fErr) {
        console.warn("[LocationProvider] Family friends query error:", fErr.message);
        return [];
      }
      if (!friendRows || friendRows.length === 0) {
        console.log("[LocationProvider] No one added me as friend (family check)");
        return [];
      }

      const familyIds = friendRows
        .filter((f: any) => f.is_family === true || f.is_family === "true")
        .map((f: any) => f.user_id);

      console.log("[LocationProvider] Users who marked me as family:", familyIds, "out of", friendRows.length, "total");

      if (familyIds.length === 0) {
        console.log("[LocationProvider] No one marked me as family, skipping location fetch");
        return [];
      }

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name, avatar, latitude, longitude, location_place_name, location_updated_at, location_sharing_enabled, family_location_sharing")
        .in("id", familyIds);

      if (pErr) {
        console.warn("[LocationProvider] Error fetching family profiles:", pErr.message);
        return [];
      }

      if (!profiles || profiles.length === 0) {
        console.log("[LocationProvider] No profiles found for family IDs.");
        return [];
      }

      const now = Date.now();
      const STALE_MS = 24 * 60 * 60 * 1000;
      const locations: FriendLocation[] = (profiles ?? [])
        .filter((p: any) => {
          const hasCoords = p.latitude != null && p.longitude != null;
          const sharingOn = p.location_sharing_enabled !== false;
          const familySharing = p.family_location_sharing !== false;
          const isRecent = !p.location_updated_at || (now - new Date(p.location_updated_at).getTime()) < STALE_MS;
          console.log("[LocationProvider] Family filter check for", p.name, ":", { hasCoords, sharingOn, familySharing, isRecent });
          return hasCoords && sharingOn && familySharing && isRecent;
        })
        .map((p: any) => ({
          userId: p.id,
          name: p.name ?? "Family",
          avatar: p.avatar ?? undefined,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          placeName: p.location_place_name ?? undefined,
          updatedAt: p.location_updated_at ?? new Date().toISOString(),
        }));

      console.log("[LocationProvider] Final family locations:", locations.length, "out of", profiles.length, "profiles");
      return locations;
    },
    enabled: !!currentUserId,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const friendLocations = useMemo(() => friendLocationsQuery.data ?? [], [friendLocationsQuery.data]);
  const familyLocations = useMemo(() => familyLocationsQuery.data ?? [], [familyLocationsQuery.data]);

  return useMemo(
    () => ({
      userLocation,
      locationLoading,
      locationError,
      requestLocation,
      setLocationUser,
      sharingEnabled,
      setSharingEnabled,
      closeFriendSharingEnabled,
      setCloseFriendSharingEnabled,
      familySharingEnabled,
      setFamilySharingEnabled,
      friendLocations,
      familyLocations,
      friendLocationsLoading: friendLocationsQuery.isLoading,
      familyLocationsLoading: familyLocationsQuery.isLoading,
      liveLocationActive,
      liveLocationDuration,
      liveLocationRemainingLabel,
      backgroundPermissionGranted,
      startLiveLocation,
      stopLiveLocation,
      requestBackgroundPermission,
      toggleBackgroundGps,
    }),
    [userLocation, locationLoading, locationError, requestLocation, setLocationUser, sharingEnabled, closeFriendSharingEnabled, familySharingEnabled, friendLocations, familyLocations, friendLocationsQuery.isLoading, familyLocationsQuery.isLoading, liveLocationActive, liveLocationDuration, liveLocationRemainingLabel, backgroundPermissionGranted, startLiveLocation, stopLiveLocation, requestBackgroundPermission, toggleBackgroundGps]
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
