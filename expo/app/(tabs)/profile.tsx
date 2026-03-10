import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  LogOut,
  ChevronRight,
  Store,
  Plus,
  Shield,
  Mail,
  ToggleLeft,
  ToggleRight,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, toggleRole } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  }, [logout]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loginPrompt}>
          <View style={styles.avatarPlaceholder}>
            <User size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.loginTitle}>Welcome to FoodSpot</Text>
          <Text style={styles.loginSubtitle}>
            Sign in to leave reviews and manage restaurants
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
            testID="login-button"
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwner = user.role === "owner";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <View style={styles.emailRow}>
            <Mail size={14} color={Colors.textMuted} />
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
          <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
            <Shield
              size={12}
              color={isOwner ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.roleText, isOwner && styles.roleTextOwner]}>
              {isOwner ? "Restaurant Owner" : "Customer"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => void toggleRole()}
            testID="toggle-role"
          >
            <View style={styles.menuItemLeft}>
              {isOwner ? (
                <ToggleRight size={20} color={Colors.primary} />
              ) : (
                <ToggleLeft size={20} color={Colors.textSecondary} />
              )}
              <View>
                <Text style={styles.menuItemTitle}>Switch Role</Text>
                <Text style={styles.menuItemSubtitle}>
                  Currently: {isOwner ? "Owner" : "Customer"}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant Management</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/add-restaurant")}
              testID="add-restaurant"
            >
              <View style={styles.menuItemLeft}>
                <Plus size={20} color={Colors.success} />
                <View>
                  <Text style={styles.menuItemTitle}>Register Restaurant</Text>
                  <Text style={styles.menuItemSubtitle}>
                    $5 registration fee applies
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/my-restaurants")}
              testID="my-restaurants"
            >
              <View style={styles.menuItemLeft}>
                <Store size={20} color={Colors.primary} />
                <View>
                  <Text style={styles.menuItemTitle}>My Restaurants</Text>
                  <Text style={styles.menuItemSubtitle}>
                    View and manage your listings
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          testID="logout-button"
        >
          <LogOut size={18} color={Colors.primary} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700" as const,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBadgeOwner: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(230, 57, 70, 0.1)",
  },
  roleText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  roleTextOwner: {
    color: Colors.primary,
  },
  section: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 30,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
});
