import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  LogOut,
  Store,
  ChevronRight,
  RefreshCw,
  Plus,
  Mail,
  Eye,
  Trash2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import PinoxiaLogo from "@/components/PinoxiaLogo";
import { useAuth } from "@/providers/AuthProvider";
import { useOnlineStatus } from "@/providers/OnlineStatusProvider";
import { OnlineVisibility } from "@/types";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading, logout, deleteAccount, toggleRole } = useAuth();
  const { visibility, openStatusPicker } = useOnlineStatus();

  const visibilityLabel: Record<OnlineVisibility, string> = {
    hidden: "Invisible",
    friends_only: "Friends Only",
    everyone: "Everyone",
  };

  const visibilityColor: Record<OnlineVisibility, string> = {
    hidden: "#FF6B6B",
    friends_only: "#4ECDC4",
    everyone: "#45B7D1",
  };

  const handleLogout = useCallback(async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data, including businesses and reviews, will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Type confirms this will permanently delete your account.",
              [
                { text: "Go Back", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAccount();
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  const handleToggleRole = useCallback(async () => {
    await toggleRole();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [toggleRole]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <PinoxiaLogo size="small" />
        </View>
        <View style={styles.centered}>
          <View style={styles.avatarPlaceholder}>
            <User size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.guestTitle}>Welcome to Pinoxia</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to leave reviews, register your business, and more
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
            testID="sign-in-button"
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwner = user.role === "owner";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <PinoxiaLogo size="small" />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <View style={styles.emailRow}>
              <Mail size={13} color={Colors.textMuted} />
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
              <Text style={[styles.roleBadgeText, isOwner && styles.roleBadgeTextOwner]}>
                {isOwner ? "Business Owner" : "Customer"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openStatusPicker();
            }}
            activeOpacity={0.7}
            testID="online-status"
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: `${visibilityColor[visibility]}18` }]}>
                <Eye size={18} color={visibilityColor[visibility]} />
              </View>
              <View>
                <Text style={styles.menuItemText}>Online Status</Text>
                <Text style={[styles.menuItemSubtext, { color: visibilityColor[visibility] }]}>
                  {visibilityLabel[visibility]}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => void handleToggleRole()}
            activeOpacity={0.7}
            testID="toggle-role"
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(230,57,70,0.12)" }]}>
                <RefreshCw size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.menuItemText}>Switch Role</Text>
                <Text style={styles.menuItemSubtext}>
                  Currently: {isOwner ? "Owner" : "Customer"}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {isOwner && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/my-restaurants")}
                activeOpacity={0.7}
                testID="my-restaurants"
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(255,184,0,0.12)" }]}>
                    <Store size={18} color={Colors.star} />
                  </View>
                  <Text style={styles.menuItemText}>My Businesses</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/add-restaurant")}
                activeOpacity={0.7}
                testID="add-restaurant"
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(76,175,80,0.12)" }]}>
                    <Plus size={18} color={Colors.success} />
                  </View>
                  <Text style={styles.menuItemText}>Register Business</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => void handleLogout()}
          activeOpacity={0.7}
          testID="logout-button"
        >
          <LogOut size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          testID="delete-account-button"
        >
          <Trash2 size={18} color="#FF3B30" />
          <Text style={styles.deleteText}>Delete Account</Text>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHighlight,
  },
  roleBadgeOwner: {
    backgroundColor: "rgba(230,57,70,0.15)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  roleBadgeTextOwner: {
    color: Colors.primary,
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  menuItemSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.3)",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  deleteButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,48,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.25)",
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FF3B30",
  },
});
