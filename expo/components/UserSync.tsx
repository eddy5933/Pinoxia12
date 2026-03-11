import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";

export default function UserSync() {
  const { user } = useAuth();
  const { registerUser } = useFriends();

  useEffect(() => {
    if (user) {
      console.log("[UserSync] Syncing user profile:", user.name, "role:", user.role);
      void registerUser(user);
    }
  }, [user?.id, user?.role, user?.name, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
