import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Friend, FriendRequest, User } from "@/types";
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
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadQuery = useQuery({
    queryKey: ["friends_load", currentUserId],
    queryFn: async () => {
      console.log("[FriendsProvider] Loading data from Supabase for user:", currentUserId);

      const friendsQuery = currentUserId
        ? supabase.from("friends").select("*").eq("user_id", currentUserId)
        : supabase.from("friends").select("*").limit(0);

      const requestsQuery = currentUserId
        ? supabase.from("friend_requests").select("*").or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
        : supabase.from("friend_requests").select("*").limit(0);

      const [profilesRes, friendsRes, requestsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        friendsQuery,
        requestsQuery,
      ]);

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

      const loadedRequests: FriendRequest[] = (requestsRes.data ?? []).map((r: any) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        fromUserName: r.from_user_name,
        fromUserEmail: r.from_user_email,
        toUserId: r.to_user_id,
        toUserName: r.to_user_name,
        toUserEmail: r.to_user_email,
        status: r.status,
        createdAt: r.created_at,
      }));

      console.log("[FriendsProvider] Loaded", loadedUsers.length, "users,", loadedFriends.length, "friends,", loadedRequests.length, "requests");
      return { friends: loadedFriends, requests: loadedRequests, users: loadedUsers };
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setFriends(loadQuery.data.friends);
      setRequests(loadQuery.data.requests);
      setAllUsers(loadQuery.data.users);
    }
  }, [loadQuery.data]);

  const registerUser = useCallback(async (user: User) => {
    console.log("[FriendsProvider] Registering user in Supabase:", user.name);
    setCurrentUserId(user.id);
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
    }
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

  const sendFriendRequest = useCallback(
    async (fromUser: User, toUser: PublicUser) => {
      const existing = requests.find(
        (r) =>
          ((r.fromUserId === fromUser.id && r.toUserId === toUser.id) ||
            (r.fromUserId === toUser.id && r.toUserId === fromUser.id)) &&
          r.status === "pending"
      );
      if (existing) {
        console.log("[FriendsProvider] Request already exists");
        return false;
      }
      const alreadyFriend = friends.find((f) => f.userId === toUser.id);
      if (alreadyFriend) {
        console.log("[FriendsProvider] Already friends");
        return false;
      }

      const { data, error } = await supabase
        .from("friend_requests")
        .insert({
          from_user_id: fromUser.id,
          from_user_name: fromUser.name,
          from_user_email: fromUser.email,
          to_user_id: toUser.id,
          to_user_name: toUser.name,
          to_user_email: toUser.email,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.warn("[FriendsProvider] Send request error:", error.message);
        return false;
      }

      const newRequest: FriendRequest = {
        id: data.id,
        fromUserId: fromUser.id,
        fromUserName: fromUser.name,
        fromUserEmail: fromUser.email,
        toUserId: toUser.id,
        toUserName: toUser.name,
        toUserEmail: toUser.email,
        status: "pending",
        createdAt: data.created_at,
      };
      setRequests((prev) => [newRequest, ...prev]);
      console.log("[FriendsProvider] Sent friend request to", toUser.name);
      return true;
    },
    [requests, friends]
  );

  const acceptFriendRequest = useCallback(
    async (requestId: string, currentUserId: string) => {
      const req = requests.find((r) => r.id === requestId);
      if (!req) return;

      await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "accepted" as const } : r))
      );

      const otherUserId = req.fromUserId === currentUserId ? req.toUserId : req.fromUserId;
      const otherUserName = req.fromUserId === currentUserId ? req.toUserName : req.fromUserName;
      const otherUserEmail = req.fromUserId === currentUserId ? req.toUserEmail : req.fromUserEmail;

      const { data: f1 } = await supabase
        .from("friends")
        .insert({
          user_id: currentUserId,
          friend_id: otherUserId,
          friend_name: otherUserName,
          friend_email: otherUserEmail,
        })
        .select()
        .single();

      const currentUser = allUsers.find((u) => u.id === currentUserId);
      await supabase
        .from("friends")
        .insert({
          user_id: otherUserId,
          friend_id: currentUserId,
          friend_name: currentUser?.name ?? "",
          friend_email: currentUser?.email ?? "",
        });

      if (f1) {
        const newFriend: Friend = {
          id: f1.id,
          userId: otherUserId,
          name: otherUserName,
          email: otherUserEmail,
          isOnline: true,
        };
        setFriends((prev) => [newFriend, ...prev]);
      }
      console.log("[FriendsProvider] Accepted request from", otherUserName);
    },
    [requests, allUsers]
  );

  const rejectFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" as const } : r))
      );
      console.log("[FriendsProvider] Rejected request", requestId);
    },
    []
  );

  const cancelFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase.from("friend_requests").delete().eq("id", requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      console.log("[FriendsProvider] Cancelled request", requestId);
    },
    []
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

  const removeFriend = useCallback(
    async (friendId: string) => {
      const friend = friends.find((f) => f.id === friendId);
      await supabase.from("friends").delete().eq("id", friendId);
      if (friend) {
        await supabase
          .from("friends")
          .delete()
          .eq("friend_id", friend.userId)
          .or(`user_id.eq.${friend.userId}`);
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      console.log("[FriendsProvider] Removed friend", friendId);
    },
    [friends]
  );

  const getPendingRequests = useCallback(
    (userId: string) =>
      requests.filter((r) => r.toUserId === userId && r.status === "pending"),
    [requests]
  );

  const getSentRequests = useCallback(
    (userId: string) =>
      requests.filter((r) => r.fromUserId === userId && r.status === "pending"),
    [requests]
  );

  const isFriend = useCallback(
    (userId: string) => friends.some((f) => f.userId === userId),
    [friends]
  );

  const hasPendingRequest = useCallback(
    (fromUserId: string, toUserId: string) =>
      requests.some(
        (r) =>
          ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
            (r.fromUserId === toUserId && r.toUserId === fromUserId)) &&
          r.status === "pending"
      ),
    [requests]
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
      requests,
      allUsers,
      registerUser,
      searchUsers,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      cancelFriendRequest,
      toggleCloseFriend,
      isCloseFriend,
      getPendingRequests,
      getSentRequests,
      isFriend,
      hasPendingRequest,
      refetchUsers,
      isRefetching,
    }),
    [
      friends, closeFriends, requests, allUsers, registerUser, searchUsers,
      sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
      removeFriend, cancelFriendRequest, toggleCloseFriend, isCloseFriend,
      getPendingRequests, getSentRequests,
      isFriend, hasPendingRequest, refetchUsers, isRefetching,
    ]
  );
});
