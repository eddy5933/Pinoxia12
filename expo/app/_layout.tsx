import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/providers/AuthProvider";
import { RestaurantProvider } from "@/providers/RestaurantProvider";
import { LocationProvider } from "@/providers/LocationProvider";
import { FriendsProvider } from "@/providers/FriendsProvider";
import { ChatProvider } from "@/providers/ChatProvider";
import { OnlineStatusProvider } from "@/providers/OnlineStatusProvider";
import { NotificationProvider, NotificationToast } from "@/providers/NotificationProvider";
import StatusPickerModal from "@/components/StatusPickerModal";
import UserSync from "@/components/UserSync";
import Colors from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.white,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen
        name="restaurant/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="add-restaurant"
        options={{
          title: "Register Business",
          presentation: "modal",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.white,
        }}
      />
      <Stack.Screen
        name="my-restaurants"
        options={{
          title: "My Businesses",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.white,
        }}
      />
      <Stack.Screen
        name="edit-restaurant"
        options={{
          title: "Edit Business",
          presentation: "modal",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.white,
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RestaurantProvider>
            <LocationProvider>
              <FriendsProvider>
                <ChatProvider>
                <OnlineStatusProvider>
                  <NotificationProvider>
                    <UserSync />
                    <RootLayoutNav />
                    <StatusPickerModal />
                    <NotificationToast />
                  </NotificationProvider>
                </OnlineStatusProvider>
                </ChatProvider>
              </FriendsProvider>
            </LocationProvider>
          </RestaurantProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
