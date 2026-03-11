import { useState, useEffect, useCallback, useMemo } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, savePushToken } from "@/lib/pushNotifications";
import { User, UserRole } from "@/types";

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("[Auth] Session check:", session ? "found" : "none");
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            const loadedUser: User = {
              id: profile.id,
              email: profile.email,
              name: profile.name,
              role: profile.role ?? "customer",
              avatar: profile.avatar ?? undefined,
            };
            setUser(loadedUser);
            console.log("[Auth] Loaded profile:", profile.name);

            void registerForPushNotifications().then((token) => {
              if (token) void savePushToken(loadedUser.id, token);
            });
          }
        }
      } catch (e) {
        console.warn("[Auth] Session load error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] Auth state changed:", event);
        if (event === "SIGNED_OUT" || !session?.user) {
          setUser(null);
          return;
        }
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              name: profile.name,
              role: profile.role ?? "customer",
              avatar: profile.avatar ?? undefined,
            });
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    console.log("[Auth] Logging in:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.warn("[Auth] Login error:", error.message);
      throw new Error(error.message);
    }
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profile) {
        const u: User = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role ?? "customer",
          avatar: profile.avatar ?? undefined,
        };
        setUser(u);
        console.log("[Auth] Login success:", u.name);

        void registerForPushNotifications().then((token) => {
          if (token) void savePushToken(u.id, token);
        });

        return u;
      }
    }
    return null;
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    console.log("[Auth] Signing up:", email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      console.warn("[Auth] Signup error:", error.message);
      throw new Error(error.message);
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          email,
          name,
          role: "customer",
        });
      if (profileError) {
        console.warn("[Auth] Profile upsert error:", profileError.message);
      }
      const u: User = {
        id: data.user.id,
        email,
        name,
        role: "customer",
      };
      setUser(u);
      console.log("[Auth] Signup success:", u.name);

      void registerForPushNotifications().then((token) => {
        if (token) void savePushToken(u.id, token);
      });

      return u;
    }
    return null;
  }, []);

  const logout = useCallback(async () => {
    console.log("[Auth] Logging out");
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    console.log("[Auth] Deleting account:", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.from("friends").delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    await supabase.from("friend_requests").delete().or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    await supabase.auth.signOut();
    setUser(null);
  }, [user]);

  const toggleRole = useCallback(async () => {
    if (!user) return;
    const newRole: UserRole = user.role === "customer" ? "owner" : "customer";
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", user.id);
    if (error) {
      console.warn("[Auth] Toggle role error:", error.message);
      return;
    }
    setUser({ ...user, role: newRole });
    console.log("[Auth] Role updated to:", newRole);
  }, [user]);

  return useMemo(
    () => ({ user, isLoading, login, signup, logout, deleteAccount, toggleRole }),
    [user, isLoading, login, signup, logout, deleteAccount, toggleRole]
  );
});
