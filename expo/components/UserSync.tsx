import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { cloudUsersApi } from "@/lib/api";

export default function UserSync() {
  const { user } = useAuth();
  const { registerUser } = useFriends();

  useEffect(() => {
    if (user) {
      console.log("[UserSync] Syncing user profile:", user.name, "role:", user.role);
      void registerUser(user);
      cloudUsersApi.upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }).then(() => {
        console.log("[UserSync] Cloud sync complete for:", user.name);
      }).catch((e) => {
        console.warn("[UserSync] Cloud sync failed:", e);
      });
    }
  }, [user?.id, user?.role, user?.name, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
