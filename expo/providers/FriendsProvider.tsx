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

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[FriendsProvider] Current session:", session ? session.user.id : "none");

      const [profilesRes, friendsRes, requestsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        currentUserId
          ? supabase.from("friends").select("*").eq("user_id", currentUserId)
          : Promise.resolve({ data: [] as any[], error: null }),
        currentUserId
          ? supabase.from("friend_requests").select("*").or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (profilesRes.error) {
        console.warn("[FriendsProvider] Profiles query error:", profilesRes.error.message, profilesRes.error.details, profilesRes.error.hint);
      }
      if (friendsRes.error) {
        console.warn("[FriendsProvider] Friends query error:", friendsRes.error.message);
      }
      if (requestsRes.error) {
        console.warn("[FriendsProvider] Requests query error:", requestsRes.error.message);
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
    enabled: !!currentUserId,
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

  useEffect(() => {
    if (!currentUserId) return;
    console.log("[FriendsProvider] Setting up realtime subscriptions");

    const channel = supabase
      .channel("friends_realtime")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "friend_requests" },
        (payload: any) => {
          console.log("[FriendsProvider] Realtime new friend_request:", payload.new?.id);
          const r = payload.new;
          if (!r) return;
          if (r.to_user_id !== currentUserId && r.from_user_id !== currentUserId) return;

          const newReq: FriendRequest = {
            id: r.id,
            fromUserId: r.from_user_id,
            fromUserName: r.from_user_name,
            fromUserEmail: r.from_user_email,
            toUserId: r.to_user_id,
            toUserName: r.to_user_name,
            toUserEmail: r.to_user_email,
            status: r.status,
            createdAt: r.created_at,
          };

          setRequests((prev) => {
            if (prev.some((req) => req.id === newReq.id)) return prev;
            return [newReq, ...prev];
          });
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "friend_requests" },
        (payload: any) => {
          console.log("[FriendsProvider] Realtime updated friend_request:", payload.new?.id, "status:", payload.new?.status);
          const r = payload.new;
          if (!r) return;
          if (r.from_user_id !== currentUserId && r.to_user_id !== currentUserId) return;

          setRequests((prev) =>
            prev.map((req) =>
              req.id === r.id ? { ...req, status: r.status } : req
            )
          );

          if (r.status === "accepted") {
            console.log("[FriendsProvider] Friend request accepted via realtime, current user:", currentUserId);

            const isRequester = r.from_user_id === currentUserId;
            const otherUserId = isRequester ? r.to_user_id : r.from_user_id;
            const otherUserName = isRequester ? r.to_user_name : r.from_user_name;
            const otherUserEmail = isRequester ? r.to_user_email : r.from_user_email;

            const newFriend: Friend = {
              id: `temp_${Date.now()}`,
              userId: otherUserId,
              name: otherUserName,
              email: otherUserEmail,
              isOnline: true,
              isCloseFriend: false,
            };

            setFriends((prev) => {
              if (prev.some((fr) => fr.userId === otherUserId)) return prev;
              console.log("[FriendsProvider] Realtime: immediately adding friend to local state:", otherUserName);
              return [newFriend, ...prev];
            });

            queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
              if (!old) return old;
              if (old.friends.some((f: any) => f.userId === otherUserId)) return old;
              return { ...old, friends: [newFriend, ...old.friends] };
            });

            const refetchAll = () => {
              console.log("[FriendsProvider] Force refetching friends after accept");
              void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
              void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
            };

            refetchAll();
            setTimeout(refetchAll, 1000);
            setTimeout(refetchAll, 3000);
          }
        }
      )
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
            console.log("[FriendsProvider] Adding new friend to local state:", newFriend.name);
            return [newFriend, ...prev];
          });

          queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
            if (!old) return old;
            if (old.friends.some((fr: any) => fr.id === newFriend.id || fr.userId === newFriend.userId)) return old;
            return { ...old, friends: [newFriend, ...old.friends] };
          });

          void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
          void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
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

  const addFriendDirectly = useCallback(
    async (fromUser: User, toUser: PublicUser) => {
      const alreadyFriend = friends.find((f) => f.userId === toUser.id);
      if (alreadyFriend) {
        console.log("[FriendsProvider] Already friends with", toUser.name);
        return false;
      }

      console.log("[FriendsProvider] Adding friend directly:", toUser.name);

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
        console.warn("[FriendsProvider] Add friend (my side) error:", e1.message);
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
        console.warn("[FriendsProvider] Add friend (other side) error:", e2.message);
      }

      if (f1) {
        const newFriend: Friend = {
          id: f1.id,
          userId: toUser.id,
          name: toUser.name,
          email: toUser.email,
          isOnline: true,
          isCloseFriend: false,
        };
        setFriends((prev) => [newFriend, ...prev]);
        console.log("[FriendsProvider] Friend added successfully:", toUser.name);
      }

      await queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
      return true;
    },
    [friends, queryClient, currentUserId]
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
      if (!req) {
        console.warn("[FriendsProvider] acceptFriendRequest: request not found", requestId);
        return;
      }

      console.log("[FriendsProvider] Accepting friend request:", requestId, "from", req.fromUserName, "to", req.toUserName);

      const { error: updateError } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (updateError) {
        console.warn("[FriendsProvider] Failed to update request status:", updateError.message);
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "accepted" as const } : r))
      );

      const otherUserId = req.fromUserId === currentUserId ? req.toUserId : req.fromUserId;
      const otherUserName = req.fromUserId === currentUserId ? req.toUserName : req.fromUserName;
      const otherUserEmail = req.fromUserId === currentUserId ? req.toUserEmail : req.fromUserEmail;

      const currentUser = allUsers.find((u) => u.id === currentUserId);
      const currentUserName = currentUser?.name ?? req.toUserName ?? "";
      const currentUserEmail = currentUser?.email ?? req.toUserEmail ?? "";

      const { data: existingMyFriend } = await supabase
        .from("friends")
        .select("*")
        .eq("user_id", currentUserId)
        .eq("friend_id", otherUserId)
        .maybeSingle();

      let f1: any = existingMyFriend;
      if (!existingMyFriend) {
        const { data, error: e1 } = await supabase
          .from("friends")
          .insert({
            user_id: currentUserId,
            friend_id: otherUserId,
            friend_name: otherUserName,
            friend_email: otherUserEmail,
          })
          .select()
          .single();
        if (e1) {
          console.warn("[FriendsProvider] Insert my friend row error:", e1.message);
        } else {
          f1 = data;
          console.log("[FriendsProvider] Inserted my friend row:", data?.id);
        }
      } else {
        console.log("[FriendsProvider] My friend row already exists:", existingMyFriend.id);
      }

      const { data: existingTheirFriend } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", otherUserId)
        .eq("friend_id", currentUserId)
        .maybeSingle();

      if (!existingTheirFriend) {
        const { error: e2 } = await supabase
          .from("friends")
          .insert({
            user_id: otherUserId,
            friend_id: currentUserId,
            friend_name: currentUserName,
            friend_email: currentUserEmail,
          });
        if (e2) {
          console.warn("[FriendsProvider] Insert their friend row error:", e2.message);
        } else {
          console.log("[FriendsProvider] Inserted their friend row for user:", otherUserId);
        }
      } else {
        console.log("[FriendsProvider] Their friend row already exists:", existingTheirFriend.id);
      }

      const newFriend: Friend = {
        id: f1?.id ?? `temp_${Date.now()}`,
        userId: otherUserId,
        name: otherUserName,
        email: otherUserEmail,
        isOnline: true,
        isCloseFriend: false,
      };
      setFriends((prev) => {
        if (prev.some((fr) => fr.userId === otherUserId)) {
          console.log("[FriendsProvider] Friend already in local state, skipping add");
          return prev;
        }
        console.log("[FriendsProvider] Adding accepted friend to acceptor local state:", otherUserName);
        return [newFriend, ...prev];
      });

      queryClient.setQueryData(["friends_load", currentUserId], (old: any) => {
        if (!old) return old;
        const alreadyExists = old.friends.some((f: any) => f.userId === otherUserId);
        if (alreadyExists) return old;
        return {
          ...old,
          friends: [newFriend, ...old.friends],
        };
      });

      console.log("[FriendsProvider] Creating conversation between users so they can chat");
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .contains("participants", [currentUserId])
        .contains("participants", [otherUserId])
        .maybeSingle();

      if (!existingConvo) {
        const participantNames: Record<string, string> = {
          [currentUserId]: currentUserName,
          [otherUserId]: otherUserName,
        };
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({
            participants: [currentUserId, otherUserId],
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

      console.log("[FriendsProvider] Accepted request from", otherUserName, "- invalidating queries");
      await queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
      await queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
    },
    [requests, allUsers, queryClient, currentUserId]
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
      searchUsersFromSupabase,
      sendFriendRequest,
      addFriendDirectly,
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
      searchUsersFromSupabase, sendFriendRequest, addFriendDirectly, acceptFriendRequest, rejectFriendRequest,
      removeFriend, cancelFriendRequest, toggleCloseFriend, isCloseFriend,
      getPendingRequests, getSentRequests,
      isFriend, hasPendingRequest, refetchUsers, isRefetching,
    ]
  );
});
