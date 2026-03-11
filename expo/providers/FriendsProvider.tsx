import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Friend, User } from "@/types";
import { supabase } from "@/lib/supabase";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
}

export const [FriendsProvider, useFriends] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadQuery = useQuery({
    queryKey: ["friends_load", currentUserId],
    queryFn: async () => {
      console.log("[FriendsProvider] Loading data from Supabase for user:", currentUserId);

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[FriendsProvider] Current session:", session ? session.user.id : "none");

      const [profilesRes, friendsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        currentUserId
          ? supabase.from("friends").select("*").eq("user_id", currentUserId)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (profilesRes.error) {
        console.warn("[FriendsProvider] Profiles query error:", profilesRes.error.message, profilesRes.error.details, profilesRes.error.hint);
      }
      if (friendsRes.error) {
        console.warn("[FriendsProvider] Friends query error:", friendsRes.error.message);
      }

      console.log("[FriendsProvider] Raw profiles count:", profilesRes.data?.length ?? 0);

      const loadedUsers: PublicUser[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role ?? "customer",
        avatar: p.avatar ?? undefined,
      }));

      const loadedFriends: Friend[] = (friendsRes.data ?? []).map((f: any) => ({
        id: f.id,
        userId: f.friend_id,
        name: f.friend_name,
        email: f.friend_email,
        avatar: f.friend_avatar ?? undefined,
        isOnline: true,
        isCloseFriend: f.is_close_friend ?? false,
      }));

      console.log("[FriendsProvider] Loaded", loadedUsers.length, "users,", loadedFriends.length, "friends (followers)");
      return { friends: loadedFriends, users: loadedUsers };
    },
    enabled: !!currentUserId,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setFriends(loadQuery.data.friends);
      setAllUsers(loadQuery.data.users);
    }
  }, [loadQuery.data]);

  useEffect(() => {
    if (!currentUserId) return;
    console.log("[FriendsProvider] Setting up realtime subscriptions");

    const channel = supabase
      .channel("friends_realtime")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "friends" },
        (payload: any) => {
          console.log("[FriendsProvider] Realtime new friend row:", payload.new?.id, "user_id:", payload.new?.user_id);
          const f = payload.new;
          if (!f) return;
          if (f.user_id !== currentUserId) return;

          const newFriend: Friend = {
            id: f.id,
            userId: f.friend_id,
            name: f.friend_name,
            email: f.friend_email,
            avatar: f.friend_avatar ?? undefined,
            isOnline: true,
            isCloseFriend: f.is_close_friend ?? false,
          };

          setFriends((prev) => {
            if (prev.some((fr) => fr.id === newFriend.id || fr.userId === newFriend.userId)) return prev;
            console.log("[FriendsProvider] Adding new follower to local state:", newFriend.name);
            return [newFriend, ...prev];
          });

          void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "DELETE", schema: "public", table: "friends" },
        (payload: any) => {
          console.log("[FriendsProvider] Realtime friend deleted:", payload.old?.id);
          const old = payload.old;
          if (!old) return;
          if (old.user_id !== currentUserId) return;

          setFriends((prev) => prev.filter((fr) => fr.id !== old.id));
          void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
        }
      )
      .subscribe((status: string) => {
        console.log("[FriendsProvider] Realtime subscription status:", status);
      });

    return () => {
      console.log("[FriendsProvider] Cleaning up realtime subscription");
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, queryClient]);

  const registerUser = useCallback(async (user: User) => {
    console.log("[FriendsProvider] Registering user in Supabase:", user.name, user.id);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar ?? null,
      });
    if (error) {
      console.warn("[FriendsProvider] Upsert profile error:", error.message);
    } else {
      console.log("[FriendsProvider] Profile upserted successfully for:", user.name);
    }
    setCurrentUserId(user.id);
  }, []);

  const searchUsers = useCallback(
    (query: string, currentUserId: string) => {
      const filtered = allUsers.filter((u) => u.id !== currentUserId);
      if (!query.trim()) return filtered;
      const q = query.toLowerCase();
      return filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.role === "owner" && "business".includes(q))
      );
    },
    [allUsers]
  );

  const searchUsersFromSupabase = useCallback(
    async (query: string, userId: string): Promise<PublicUser[]> => {
      if (!query.trim()) {
        console.log("[FriendsProvider] Empty query, returning all users from Supabase");
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .neq("id", userId)
          .limit(50);
        if (error) {
          console.warn("[FriendsProvider] Supabase search error:", error.message);
          return allUsers.filter((u) => u.id !== userId);
        }
        return (data ?? []).map((p: any) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          role: p.role ?? "customer",
          avatar: p.avatar ?? undefined,
        }));
      }
      const q = query.trim();
      console.log("[FriendsProvider] Searching Supabase for:", q);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", userId)
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);
      if (error) {
        console.warn("[FriendsProvider] Supabase search error:", error.message);
        return searchUsers(query, userId);
      }
      console.log("[FriendsProvider] Supabase search returned", data?.length ?? 0, "results");
      return (data ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role ?? "customer",
        avatar: p.avatar ?? undefined,
      }));
    },
    [allUsers, searchUsers]
  );

  const followUser = useCallback(
    async (fromUser: User, toUser: PublicUser) => {
      const alreadyFollowing = friends.some((f) => f.userId === toUser.id);
      if (alreadyFollowing) {
        console.log("[FriendsProvider] Already following", toUser.name);
        return false;
      }

      console.log("[FriendsProvider] Following user:", toUser.name);

      const { data: f1, error: e1 } = await supabase
        .from("friends")
        .insert({
          user_id: fromUser.id,
          friend_id: toUser.id,
          friend_name: toUser.name,
          friend_email: toUser.email,
        })
        .select()
        .single();

      if (e1) {
        console.warn("[FriendsProvider] Follow (my side) error:", e1.message);
        return false;
      }

      const { error: e2 } = await supabase
        .from("friends")
        .insert({
          user_id: toUser.id,
          friend_id: fromUser.id,
          friend_name: fromUser.name,
          friend_email: fromUser.email,
        });

      if (e2) {
        console.warn("[FriendsProvider] Follow (other side) error:", e2.message);
      }

      if (f1) {
        const newFriend: Friend = {
          id: f1.id,
          userId: toUser.id,
          name: toUser.name,
          email: toUser.email,
          avatar: toUser.avatar,
          isOnline: true,
          isCloseFriend: false,
        };
        setFriends((prev) => {
          if (prev.some((fr) => fr.userId === toUser.id)) return prev;
          return [newFriend, ...prev];
        });

        queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
          if (!old) return old;
          const alreadyExists = old.friends.some((f: any) => f.userId === toUser.id);
          if (alreadyExists) return old;
          return { ...old, friends: [newFriend, ...old.friends] };
        });
      }

      console.log("[FriendsProvider] Creating conversation so they can chat");
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .contains("participants", [fromUser.id])
        .contains("participants", [toUser.id])
        .maybeSingle();

      if (!existingConvo) {
        const participantNames: Record<string, string> = {
          [fromUser.id]: fromUser.name,
          [toUser.id]: toUser.name,
        };
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({
            participants: [fromUser.id, toUser.id],
            participant_names: participantNames,
            unread_count: 0,
          })
          .select()
          .single();

        if (convoError) {
          console.warn("[FriendsProvider] Create conversation error:", convoError.message);
        } else {
          console.log("[FriendsProvider] Created conversation:", newConvo?.id);
        }
      } else {
        console.log("[FriendsProvider] Conversation already exists:", existingConvo.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
      await queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });

      console.log("[FriendsProvider] Successfully followed", toUser.name);
      return true;
    },
    [friends, queryClient, currentUserId]
  );

  const unfollowUser = useCallback(
    async (friendId: string) => {
      const friend = friends.find((f) => f.id === friendId);
      if (!friend) {
        console.warn("[FriendsProvider] unfollowUser: friend not found for id:", friendId);
        return;
      }

      console.log("[FriendsProvider] Unfollowing:", friend.name);

      await supabase.from("friends").delete().eq("id", friendId);

      if (currentUserId) {
        await supabase
          .from("friends")
          .delete()
          .eq("user_id", friend.userId)
          .eq("friend_id", currentUserId);
      }

      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      console.log("[FriendsProvider] Unfollowed", friend.name);

      await queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
    },
    [friends, currentUserId, queryClient]
  );

  const toggleCloseFriend = useCallback(
    async (friendId: string) => {
      const friend = friends.find((f) => f.id === friendId);
      if (!friend) {
        console.warn("[FriendsProvider] toggleCloseFriend: friend not found for id:", friendId);
        return;
      }
      const newValue = !friend.isCloseFriend;
      console.log("[FriendsProvider] Toggling close friend:", friend.name, "=>", newValue);

      await queryClient.cancelQueries({ queryKey: ["friends_load", currentUserId] });

      setFriends((prev) =>
        prev.map((f) => (f.id === friendId ? { ...f, isCloseFriend: newValue } : f))
      );

      queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          friends: old.friends.map((f: any) =>
            f.id === friendId ? { ...f, isCloseFriend: newValue } : f
          ),
        };
      });

      const { error } = await supabase
        .from("friends")
        .update({ is_close_friend: newValue })
        .eq("id", friendId);

      if (error) {
        console.warn("[FriendsProvider] Toggle close friend error:", error.message);
        setFriends((prev) =>
          prev.map((f) => (f.id === friendId ? { ...f, isCloseFriend: !newValue } : f))
        );
        queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            friends: old.friends.map((f: any) =>
              f.id === friendId ? { ...f, isCloseFriend: !newValue } : f
            ),
          };
        });
      } else {
        console.log("[FriendsProvider] Close friend saved successfully:", friend.name, "=>", newValue);
        await queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
      }
    },
    [friends, queryClient, currentUserId]
  );

  const closeFriends = useMemo(
    () => friends.filter((f) => f.isCloseFriend),
    [friends]
  );

  const isCloseFriend = useCallback(
    (userId: string) => friends.some((f) => f.userId === userId && f.isCloseFriend),
    [friends]
  );

  const isFollowing = useCallback(
    (userId: string) => friends.some((f) => f.userId === userId),
    [friends]
  );

  const refetchUsers = useCallback(async () => {
    console.log("[FriendsProvider] Refetching from Supabase...");
    await loadQuery.refetch();
  }, [loadQuery]);

  const isRefetching = loadQuery.isRefetching || loadQuery.isLoading;

  return useMemo(
    () => ({
      friends,
      closeFriends,
      allUsers,
      registerUser,
      searchUsers,
      searchUsersFromSupabase,
      followUser,
      unfollowUser,
      toggleCloseFriend,
      isCloseFriend,
      isFollowing,
      refetchUsers,
      isRefetching,
    }),
    [
      friends, closeFriends, allUsers, registerUser, searchUsers,
      searchUsersFromSupabase, followUser, unfollowUser,
      toggleCloseFriend, isCloseFriend,
      isFollowing, refetchUsers, isRefetching,
    ]
  );
});
