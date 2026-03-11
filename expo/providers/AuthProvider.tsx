import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { User, UserRole } from "@/types";

const AUTH_STORAGE_KEY = "foodspot_auth";
const ALL_ACCOUNTS_KEY = "foodspot_all_accounts";

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
    const storedAccounts = await AsyncStorage.getItem(ALL_ACCOUNTS_KEY);
    const accounts: User[] = storedAccounts ? JSON.parse(storedAccounts) : [];
    const existing = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      console.log("[Auth] Found existing account for", email, "id:", existing.id);
      setUser(existing);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(existing));
      return existing;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name: email.split("@")[0],
      role: "customer",
    };
    const updatedAccounts = [...accounts, newUser];
    setUser(newUser);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem(ALL_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    console.log("[Auth] Created new account for", email, "id:", newUser.id);
    return newUser;
  }, []);

  const signup = useCallback(async (email: string, _password: string, name: string) => {
    const storedAccounts = await AsyncStorage.getItem(ALL_ACCOUNTS_KEY);
    const accounts: User[] = storedAccounts ? JSON.parse(storedAccounts) : [];
    const existing = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      console.log("[Auth] Account already exists for", email, "- logging in");
      setUser(existing);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(existing));
      return existing;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name,
      role: "customer",
    };
    const updatedAccounts = [...accounts, newUser];
    setUser(newUser);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem(ALL_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    console.log("[Auth] Signed up new account for", email, "id:", newUser.id);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const deleteAccount = useCallback(async () => {
    console.log("[Auth] Deleting account for user:", user?.id);
    if (user) {
      const storedAccounts = await AsyncStorage.getItem(ALL_ACCOUNTS_KEY);
      const accounts: User[] = storedAccounts ? JSON.parse(storedAccounts) : [];
      const filtered = accounts.filter((a) => a.id !== user.id);
      await AsyncStorage.setItem(ALL_ACCOUNTS_KEY, JSON.stringify(filtered));
    }
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }, [user]);

  const toggleRole = useCallback(async () => {
    if (!user) return;
    const newRole: UserRole = user.role === "customer" ? "owner" : "customer";
    const updated = { ...user, role: newRole };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));

    const storedAccounts = await AsyncStorage.getItem(ALL_ACCOUNTS_KEY);
    const accounts: User[] = storedAccounts ? JSON.parse(storedAccounts) : [];
    const updatedAccounts = accounts.map((a) => (a.id === user.id ? updated : a));
    await AsyncStorage.setItem(ALL_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    console.log("[Auth] Updated role to", newRole, "for", user.name);
  }, [user]);

  return useMemo(
    () => ({ user, isLoading, login, signup, logout, deleteAccount, toggleRole }),
    [user, isLoading, login, signup, logout, deleteAccount, toggleRole]
  );
});
