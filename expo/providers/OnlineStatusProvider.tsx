import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { OnlineVisibility } from "@/types";

const STATUS_KEY = "foodspot_online_status";
const STATUS_PROMPT_KEY = "foodspot_status_prompted";

export const [OnlineStatusProvider, useOnlineStatus] = createContextHook(() => {
  const [visibility, setVisibility] = useState<OnlineVisibility>("everyone");
  const [hasBeenPrompted, setHasBeenPrompted] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const loadQuery = useQuery({
    queryKey: ["online_status_load"],
    queryFn: async () => {
      console.log("[OnlineStatusProvider] Loading status...");
      const [storedStatus, prompted] = await Promise.all([
        AsyncStorage.getItem(STATUS_KEY),
        AsyncStorage.getItem(STATUS_PROMPT_KEY),
      ]);

      const loadedStatus: OnlineVisibility = storedStatus
        ? (storedStatus as OnlineVisibility)
        : "everyone";
      const wasPrompted = prompted === "true";

      console.log("[OnlineStatusProvider] Status:", loadedStatus, "Prompted:", wasPrompted);
      return { status: loadedStatus, prompted: wasPrompted };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setVisibility(loadQuery.data.status);
      setHasBeenPrompted(loadQuery.data.prompted);
      if (!loadQuery.data.prompted) {
        setShowPicker(true);
      }
    }
  }, [loadQuery.data]);

  const persistStatus = useMutation({
    mutationFn: async (status: OnlineVisibility) => {
      await AsyncStorage.setItem(STATUS_KEY, status);
      await AsyncStorage.setItem(STATUS_PROMPT_KEY, "true");
    },
  });

  const setOnlineVisibility = useCallback(
    (status: OnlineVisibility) => {
      console.log("[OnlineStatusProvider] Setting visibility to:", status);
      setVisibility(status);
      setHasBeenPrompted(true);
      setShowPicker(false);
      persistStatus.mutate(status);
    },
    [persistStatus]
  );

  const openStatusPicker = useCallback(() => {
    setShowPicker(true);
  }, []);

  const closeStatusPicker = useCallback(() => {
    if (!hasBeenPrompted) {
      setOnlineVisibility("everyone");
    }
    setShowPicker(false);
  }, [hasBeenPrompted, setOnlineVisibility]);

  return useMemo(
    () => ({
      visibility,
      showPicker,
      hasBeenPrompted,
      isLoading: loadQuery.isLoading,
      setOnlineVisibility,
      openStatusPicker,
      closeStatusPicker,
    }),
    [visibility, showPicker, hasBeenPrompted, loadQuery.isLoading, setOnlineVisibility, openStatusPicker, closeStatusPicker]
  );
});
