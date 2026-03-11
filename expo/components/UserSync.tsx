import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useFriends } from "@/providers/FriendsProvider";
import { useLocation } from "@/providers/LocationProvider";

export default function UserSync() {
  const { user } = useAuth();
  const { registerUser } = useFriends();
  const { setLocationUser } = useLocation();

  useEffect(() => {
    if (user) {
      console.log("[UserSync] Syncing user profile:", user.name, "role:", user.role);
      void registerUser(user);
      setLocationUser(user.id);
    }
  }, [user?.id, user?.role, user?.name, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
