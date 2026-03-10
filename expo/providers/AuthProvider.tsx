import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { User, UserRole } from "@/types";

const AUTH_STORAGE_KEY = "foodspot_auth";

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (e) {
        console.log("Failed to load auth state:", e);
      } finally {
        setIsLoading(false);
      }
    };
    void loadUser();
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name: email.split("@")[0],
      role: "customer",
    };
    setUser(newUser);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  }, []);

  const signup = useCallback(async (email: string, _password: string, name: string) => {
    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name,
      role: "customer",
    };
    setUser(newUser);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const toggleRole = useCallback(async () => {
    if (!user) return;
    const newRole: UserRole = user.role === "customer" ? "owner" : "customer";
    const updated = { ...user, role: newRole };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  }, [user]);

  return useMemo(
    () => ({ user, isLoading, login, signup, logout, toggleRole }),
    [user, isLoading, login, signup, logout, toggleRole]
  );
});
