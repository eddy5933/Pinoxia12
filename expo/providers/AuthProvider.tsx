import { useState, useEffect, useCallback, useMemo } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { supabase } from "@/lib/supabase";
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
          let { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (!profile) {
            console.log("[Auth] Profile missing on state change, creating...");
            const userName = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User";
            const { data: newProfile } = await supabase
              .from("profiles")
              .upsert({
                id: session.user.id,
                email: session.user.email ?? "",
                name: userName,
                role: "customer",
              })
              .select()
              .single();
            profile = newProfile;
          }

          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              name: profile.name,
              role: profile.role ?? "customer",
              avatar: profile.avatar ?? undefined,
            });
          } else {
            setUser({
              id: session.user.id,
              email: session.user.email ?? "",
              name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
              role: "customer",
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
      console.warn("[Auth] Login error:", error.message, error.status);
      if (error.message === "Invalid login credentials") {
        throw new Error("Invalid email or password. Please check your credentials and try again.");
      }
      if (error.message === "Email not confirmed") {
        throw new Error("Please confirm your email before logging in. Check your inbox.");
      }
      throw new Error(error.message);
    }
    if (data.user) {
      console.log("[Auth] Auth successful, fetching profile for:", data.user.id);
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        console.log("[Auth] Profile not found, creating one now...");
        const userName = data.user.user_metadata?.name || email.split("@")[0];
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            email: data.user.email ?? email,
            name: userName,
            role: "customer",
          })
          .select()
          .single();

        if (upsertError) {
          console.warn("[Auth] Profile creation error:", upsertError.message);
        }
        profile = newProfile;
      }

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
        return u;
      } else {
        console.warn("[Auth] Could not load or create profile");
        const fallbackUser: User = {
          id: data.user.id,
          email: data.user.email ?? email,
          name: data.user.user_metadata?.name || email.split("@")[0],
          role: "customer",
        };
        setUser(fallbackUser);
        return fallbackUser;
      }
    }
    return null;
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    console.log("[Auth] Signing up:", email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) {
      console.warn("[Auth] Signup error:", error.message);
      throw new Error(error.message);
    }

    console.log("[Auth] Signup response - user:", data.user?.id, "session:", !!data.session);

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
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            email,
            name,
            role: "customer",
          });
        if (insertError) {
          console.warn("[Auth] Profile insert fallback error:", insertError.message);
        }
      } else {
        console.log("[Auth] Profile created successfully for:", name);
      }
    }

    if (data.user && !data.session) {
      console.log("[Auth] Signup requires email confirmation");
      throw new Error("Account created! Please check your email to confirm, then log in.");
    }

    if (data.user && data.session) {
      const u: User = {
        id: data.user.id,
        email,
        name,
        role: "customer",
      };
      setUser(u);
      console.log("[Auth] Signup success with session:", u.name);
      return u;
    }
    return null;
  }, []);

  const logout = useCallback(async () => {
    console.log("[Auth] Logging out");
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    console.log("[Auth] Sending password reset to:", email);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      console.warn("[Auth] Reset password error:", error.message);
      throw new Error(error.message);
    }
    console.log("[Auth] Password reset email sent");
  }, []);

  const verifyOtpAndUpdatePassword = useCallback(
    async (email: string, token: string, newPassword: string) => {
      console.log("[Auth] Verifying OTP for:", email);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });
      if (error) {
        console.warn("[Auth] OTP verification error:", error.message);
        throw new Error(error.message);
      }
      console.log("[Auth] OTP verified, updating password");
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        console.warn("[Auth] Update password error:", updateError.message);
        throw new Error(updateError.message);
      }
      console.log("[Auth] Password updated successfully");
    },
    []
  );

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
    () => ({ user, isLoading, login, signup, logout, deleteAccount, toggleRole, resetPassword, verifyOtpAndUpdatePassword }),
    [user, isLoading, login, signup, logout, deleteAccount, toggleRole, resetPassword, verifyOtpAndUpdatePassword]
  );
});
