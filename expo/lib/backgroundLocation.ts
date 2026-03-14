import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BACKGROUND_LOCATION_TASK = "background-location-task";
const LIVE_LOC_STORAGE_KEY = "pinoxia_live_location";
const BG_USER_ID_KEY = "pinoxia_bg_user_id";

let bgSupabaseInstance: SupabaseClient | null = null;

function getBackgroundSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("[BackgroundLocation] Missing Supabase credentials");
    return null;
  }
  if (!bgSupabaseInstance) {
    bgSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return bgSupabaseInstance;
}

async function ensureAuthSession(client: SupabaseClient): Promise<boolean> {
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.log("[BackgroundLocation] getSession error:", error.message);
    }
    if (session) {
      console.log("[BackgroundLocation] Session found, expires at:", session.expires_at);
      const expiresAt = (session.expires_at ?? 0) * 1000;
      if (expiresAt > 0 && expiresAt < Date.now() + 60000) {
        console.log("[BackgroundLocation] Session expiring soon, refreshing");
        const { error: refreshError } = await client.auth.refreshSession();
        if (refreshError) {
          console.log("[BackgroundLocation] Session refresh failed:", refreshError.message);
          return false;
        }
        console.log("[BackgroundLocation] Session refreshed successfully");
      }
      return true;
    }
    console.log("[BackgroundLocation] No session found, attempting refresh");
    const { data: refreshData, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      console.log("[BackgroundLocation] Could not restore session:", refreshError?.message);
      return false;
    }
    console.log("[BackgroundLocation] Session restored via refresh");
    return true;
  } catch (err) {
    console.log("[BackgroundLocation] Auth session check error:", err);
    return false;
  }
}

if (Platform.OS !== "web") {
  const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");

  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.log("[BackgroundLocation] Task error:", error.message);
      return;
    }

    const locationData = data as { locations?: Array<{ coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }> };
    if (!locationData?.locations || locationData.locations.length === 0) {
      console.log("[BackgroundLocation] No locations in task data");
      return;
    }

    const location = locationData.locations[0];
    const { latitude, longitude } = location.coords;
    console.log("[BackgroundLocation] Received background location:", latitude, longitude, "accuracy:", location.coords.accuracy, "timestamp:", new Date(location.timestamp).toISOString());

    try {
      const liveState = await AsyncStorage.getItem(LIVE_LOC_STORAGE_KEY);
      if (!liveState) {
        console.log("[BackgroundLocation] Live location not active, stopping task");
        try {
          const Location = require("expo-location") as typeof import("expo-location");
          const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          if (isRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          }
        } catch (stopErr) {
          console.log("[BackgroundLocation] Error stopping task:", stopErr);
        }
        return;
      }

      const parsed = JSON.parse(liveState);
      if (parsed.duration !== "always" && parsed.endTime && parsed.endTime <= Date.now()) {
        console.log("[BackgroundLocation] Live location expired, cleaning up");
        await AsyncStorage.removeItem(LIVE_LOC_STORAGE_KEY);
        try {
          const Location = require("expo-location") as typeof import("expo-location");
          const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          if (isRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          }
        } catch (stopErr) {
          console.log("[BackgroundLocation] Error stopping expired task:", stopErr);
        }
        return;
      }

      const userId = await AsyncStorage.getItem(BG_USER_ID_KEY);
      if (!userId) {
        console.log("[BackgroundLocation] No user ID stored for background updates");
        return;
      }

      const bgSupabase = getBackgroundSupabase();
      if (!bgSupabase) return;

      const hasSession = await ensureAuthSession(bgSupabase);
      if (!hasSession) {
        console.log("[BackgroundLocation] No valid auth session, skipping update");
        return;
      }

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
        console.log("[BackgroundLocation] Failed to update location:", updateError.message, updateError.code);
        if (updateError.message?.includes("JWT") || updateError.code === "PGRST301") {
          console.log("[BackgroundLocation] Auth issue detected, clearing instance for refresh");
          bgSupabaseInstance = null;
        }
      } else {
        console.log("[BackgroundLocation] Location updated in Supabase:", latitude, longitude, "at", new Date().toISOString());
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

    const locationOptions: Record<string, unknown> = {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      foregroundService: {
        notificationTitle: "Pinoxia",
        notificationBody: "Sharing your live location",
        notificationColor: "#FF6B35",
        killServiceOnDestroy: false,
      },
    };

    if (Platform.OS === "android") {
      locationOptions.timeInterval = 30000;
      locationOptions.deferredUpdatesInterval = 30000;
      locationOptions.deferredUpdatesDistance = 50;
    }

    await Location.startLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
      locationOptions as Parameters<typeof Location.startLocationUpdatesAsync>[1]
    );

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
