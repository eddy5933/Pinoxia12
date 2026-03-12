import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MapPinned } from "lucide-react-native";
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
      <Stack.Screen name="forgot-password" options={{ headerShown: false, presentation: "modal" }} />
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

function CustomSplash({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
    Animated.spring(iconScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 50,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <Animated.View style={[splashStyles.content, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[splashStyles.iconBox, { transform: [{ scale: iconScaleAnim }] }]}>
          <MapPinned size={38} color="#FFFFFF" />
        </Animated.View>
        <View style={splashStyles.titleRow}>
          <Text style={splashStyles.titlePino}>Pino</Text>
          <Text style={splashStyles.titleXia}>xia</Text>
        </View>
        <Text style={splashStyles.tagline}>Discover nearby spots</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    zIndex: 999,
  },
  content: {
    alignItems: "center" as const,
    gap: 14,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#000000",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  titlePino: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: -1,
  },
  titleXia: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: -4,
  },
});

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

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
      {showSplash && <CustomSplash onFinish={() => setShowSplash(false)} />}
    </QueryClientProvider>
  );
}
