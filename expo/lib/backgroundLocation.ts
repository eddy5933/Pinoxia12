import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const BACKGROUND_LOCATION_TASK = "background-location-task";
const LIVE_LOC_STORAGE_KEY = "pinoxia_live_location";
const BG_USER_ID_KEY = "pinoxia_bg_user_id";

if (Platform.OS !== "web") {
  const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");

  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.log("[BackgroundLocation] Task error:", error.message);
      return;
    }

    const locationData = data as { locations?: Array<{ coords: { latitude: number; longitude: number } }> };
    if (!locationData?.locations || locationData.locations.length === 0) {
      console.log("[BackgroundLocation] No locations in task data");
      return;
    }

    const location = locationData.locations[0];
    const { latitude, longitude } = location.coords;
    console.log("[BackgroundLocation] Received background location:", latitude, longitude);

    try {
      const liveState = await AsyncStorage.getItem(LIVE_LOC_STORAGE_KEY);
      if (!liveState) {
        console.log("[BackgroundLocation] Live location not active, stopping task");
        const Location = require("expo-location") as typeof import("expo-location");
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
        return;
      }

      const parsed = JSON.parse(liveState);
      if (parsed.duration !== "always" && parsed.endTime && parsed.endTime <= Date.now()) {
        console.log("[BackgroundLocation] Live location expired, cleaning up");
        await AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
        const Location = require("expo-location") as typeof import("expo-location");
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
        return;
      }

      const userId = await AsyncStorage.getItem(BG_USER_ID_KEY);
      if (!userId) {
        console.log("[BackgroundLocation] No user ID stored for background updates");
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log("[BackgroundLocation] Missing Supabase credentials");
        return;
      }

      const bgSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      const { error: updateError } = await bgSupabase
        .from("profiles")
        .update({
          latitude,
          longitude,
          location_updated_at: new Date().toISOString(),
          location_sharing_enabled: true,
        })
        .eq("id", userId);

      if (updateError) {
        console.log("[BackgroundLocation] Failed to update location:", updateError.message);
      } else {
        console.log("[BackgroundLocation] Location updated in Supabase:", latitude, longitude);
      }
    } catch (err) {
      console.log("[BackgroundLocation] Error in background task:", err);
    }
  });
}

export async function startBackgroundLocationUpdates(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const Location = require("expo-location") as typeof import("expo-location");

    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      console.log("[BackgroundLocation] Task already running");
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,
      distanceInterval: 10,
      deferredUpdatesInterval: 15000,
      deferredUpdatesDistance: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Pinoxia",
        notificationBody: "Sharing your live location",
        notificationColor: "#FF6B35",
      },
    });

    console.log("[BackgroundLocation] Background location updates started");
    return true;
  } catch (err) {
    console.log("[BackgroundLocation] Failed to start background updates:", err);
    return false;
  }
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const Location = require("expo-location") as typeof import("expo-location");
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log("[BackgroundLocation] Background location updates stopped");
    }
  } catch (err) {
    console.log("[BackgroundLocation] Failed to stop background updates:", err);
  }
}

export async function setBackgroundUserId(userId: string): Promise<void> {
  await AsyncStorage.setItem(BG_USER_ID_KEY, userId);
  console.log("[BackgroundLocation] Stored user ID for background task:", userId);
}

export async function clearBackgroundUserId(): Promise<void> {
  await AsyncStorage.removeItem(BG_USER_ID_KEY);
  console.log("[BackgroundLocation] Cleared background user ID");
}

export { BACKGROUND_LOCATION_TASK, BG_USER_ID_KEY };
