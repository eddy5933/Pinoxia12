import { Tabs } from "expo-router";
import { Search, MapPin, User, Users } from "lucide-react-native";
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import { useChat } from "@/providers/ChatProvider";


function TabIcon({ icon: Icon, color, size, badgeCount }: { icon: typeof Users; color: string; size: number; badgeCount: number }) {
  return (
    <View style={tabIconStyles.wrapper}>
      <Icon color={color} size={size} />
      {badgeCount > 0 && (
        <View style={tabIconStyles.badge}>
          <Text style={tabIconStyles.badgeText}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    position: "relative" as const,
    width: 28,
    height: 28,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  badge: {
    position: "absolute" as const,
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.tabBar,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});

export default function TabLayout() {
  const { totalUnreadCount } = useChat();
  const friendBadgeCount = useMemo(() => {
    return totalUnreadCount;
  }, [totalUnreadCount]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600" as const,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon={Users} color={color} size={size} badgeCount={friendBadgeCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
