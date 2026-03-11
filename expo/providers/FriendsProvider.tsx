import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Friend, FriendRequest, User } from "@/types";
import { supabase } from "@/lib/supabase";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
}

interface FriendsData {
  friends: Friend[];
  followers: Friend[];
  following: Friend[];
  requests: FriendRequest[];
}

const EMPTY_DATA: FriendsData = {
  friends: [],
  followers: [],
  following: [],
  requests: [],
};

async function fetchFriendsData(userId: string): Promise<FriendsData> {
  console.log("[Friends] Fetching data for user:", userId);

  const [friendsRes, requestsRes] = await Promise.all([
    supabase
      .from("friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
  ]);

  if (friendsRes.error) {
    console.warn("[Friends] Friends query error:", friendsRes.error.message);
  }
  if (requestsRes.error) {
    console.warn("[Friends] Requests query error:", requestsRes.error.message);
  }

  const rawFriends = friendsRes.data ?? [];
  const rawRequests = requestsRes.data ?? [];

  const myFollowIds = new Set<string>();
  const followedByIds = new Set<string>();

  for (const row of rawFriends) {
    if (row.user_id === userId) {
      myFollowIds.add(row.friend_id);
    } else if (row.friend_id === userId) {
      followedByIds.add(row.user_id);
    }
  }

  const mutualIds = new Set<string>();
  for (const id of myFollowIds) {
    if (followedByIds.has(id)) {
      mutualIds.add(id);
    }
  }

  const allRelatedIds = new Set<string>();
  for (const row of rawFriends) {
    allRelatedIds.add(row.user_id);
    allRelatedIds.add(row.friend_id);
  }
  for (const row of rawRequests) {
    allRelatedIds.add(row.from_user_id);
    allRelatedIds.add(row.to_user_id);
  }
  allRelatedIds.delete(userId);

  const profilesMap = new Map<string, PublicUser>();
  if (allRelatedIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", Array.from(allRelatedIds));

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, {
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role ?? "customer",
        avatar: p.avatar ?? undefined,
      });
    }
  }

  const friends: Friend[] = [];
  const friendUserIds = new Set<string>();

  for (const row of rawFriends) {
    if (row.user_id === userId && mutualIds.has(row.friend_id)) {
      if (friendUserIds.has(row.friend_id)) continue;
      friendUserIds.add(row.friend_id);
      const profile = profilesMap.get(row.friend_id);
      friends.push({
        id: row.id,
        userId: row.friend_id,
        name: profile?.name ?? row.friend_name ?? "Unknown",
        email: profile?.email ?? row.friend_email ?? "",
        avatar: profile?.avatar ?? row.friend_avatar ?? undefined,
        isOnline: true,
        isCloseFriend: row.is_close_friend ?? false,
      });
    }
  }

  const followers: Friend[] = [];
  for (const followerId of followedByIds) {
    if (mutualIds.has(followerId)) continue;
    const followerRow = rawFriends.find(
      (r: any) => r.user_id === followerId && r.friend_id === userId
    );
    if (!followerRow) continue;
    const profile = profilesMap.get(followerId);
    console.log("[Friends] Follower:", followerId, "profile:", profile?.name, "row user_id:", followerRow.user_id);
    followers.push({
      id: followerRow.id,
      userId: followerId,
      name: profile?.name ?? "Unknown",
      email: profile?.email ?? "",
      avatar: profile?.avatar ?? undefined,
      isOnline: true,
      isCloseFriend: false,
    });
  }

  const following: Friend[] = [];
  for (const followingId of myFollowIds) {
    if (mutualIds.has(followingId)) continue;
    const followRow = rawFriends.find(
      (r: any) => r.user_id === userId && r.friend_id === followingId
    );
    if (!followRow) continue;
    const profile = profilesMap.get(followingId);
    following.push({
      id: followRow.id,
      userId: followingId,
      name: profile?.name ?? followRow.friend_name ?? "Unknown",
      email: profile?.email ?? followRow.friend_email ?? "",
      avatar: profile?.avatar ?? followRow.friend_avatar ?? undefined,
      isOnline: true,
      isCloseFriend: false,
    });
  }

  const requests: FriendRequest[] = rawRequests.map((r: any) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromUserName: profilesMap.get(r.from_user_id)?.name ?? r.from_user_name,
    fromUserEmail: profilesMap.get(r.from_user_id)?.email ?? r.from_user_email,
    toUserId: r.to_user_id,
    toUserName: profilesMap.get(r.to_user_id)?.name ?? r.to_user_name,
    toUserEmail: profilesMap.get(r.to_user_id)?.email ?? r.to_user_email,
    status: r.status,
    createdAt: r.created_at,
  }));

  console.log("[Friends] Loaded:", friends.length, "friends,", followers.length, "followers,", following.length, "following,", requests.length, "requests");
  return { friends, followers, following, requests };
}

async function ensureConversation(
  userAId: string,
  userAName: string,
  userBId: string,
  userBName: string
) {
  console.log("[Friends] Ensuring conversation between", userAName, "and", userBName);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .contains("participants", [userAId])
    .contains("participants", [userBId])
    .maybeSingle();

  if (existing) {
    console.log("[Friends] Conversation already exists:", existing.id);
    return existing.id;
  }

  const participantNames: Record<string, string> = {
    [userAId]: userAName,
    [userBId]: userBName,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      participants: [userAId, userBId],
      participant_names: participantNames,
      unread_count: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[Friends] Create conversation error:", error.message);
    return null;
  }

  console.log("[Friends] Created conversation:", data.id);
  return data.id;
}

export const [FriendsProvider, useFriends] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const dataRef = useRef<FriendsData>(EMPTY_DATA);

  const dataQuery = useQuery({
    queryKey: ["friends_data", currentUserId],
    queryFn: () => fetchFriendsData(currentUserId!),
    enabled: !!currentUserId,
    staleTime: 2000,
    refetchInterval: 8000,
  });

  const currentData = dataQuery.data ?? EMPTY_DATA;
  dataRef.current = currentData;

  const invalidate = useCallback(() => {
    console.log("[Friends] Invalidating queries");
    void queryClient.invalidateQueries({ queryKey: ["friends_data", currentUserId] });
    void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
  }, [queryClient, currentUserId]);

  const delayedInvalidate = useCallback(
    (ms: number = 1500) => {
      setTimeout(() => invalidate(), ms);
    },
    [invalidate]
  );

  useEffect(() => {
    if (!currentUserId) return;
    console.log("[Friends] Setting up realtime for:", currentUserId);

    const channel = supabase
      .channel(`friends_rt_${currentUserId}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "friends" }, () => {
        console.log("[Friends] RT: friends table changed");
        invalidate();
        delayedInvalidate(2000);
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "friend_requests" }, () => {
        console.log("[Friends] RT: friend_requests table changed");
        invalidate();
      })
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        console.log("[Friends] RT: profiles updated");
        delayedInvalidate(1000);
      })
      .subscribe((status: string) => {
        console.log("[Friends] RT subscription:", status);
      });

    return () => {
      console.log("[Friends] Cleaning up RT");
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, invalidate, delayedInvalidate]);

  const registerUser = useCallback(async (user: User) => {
    console.log("[Friends] Registering user:", user.name, user.id);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar ?? null,
    });
    if (error) {
      console.warn("[Friends] Upsert profile error:", error.message);
    }
    setCurrentUserId(user.id);
  }, []);

  const searchUsersFromSupabase = useCallback(
    async (query: string, userId: string): Promise<PublicUser[]> => {
      const q = query.trim();
      if (!q) return [];
      console.log("[Friends] Searching:", q);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", userId)
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);
      if (error) {
        console.warn("[Friends] Search error:", error.message);
        return [];
      }
      return (data ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role ?? "customer",
        avatar: p.avatar ?? undefined,
      }));
    },
    []
  );

  const sendFollowMutation = useMutation({
    mutationFn: async ({ fromUser, toUser }: { fromUser: User; toUser: PublicUser }) => {
      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", fromUser.id)
        .eq("friend_id", toUser.id)
        .maybeSingle();

      if (existing) {
        console.log("[Friends] Already following:", toUser.name);
        return false;
      }

      const { error } = await supabase.from("friends").insert({
        user_id: fromUser.id,
        friend_id: toUser.id,
        friend_name: toUser.name,
        friend_email: toUser.email,
      });

      if (error) {
        console.warn("[Friends] Follow error:", error.message);
        return false;
      }

      console.log("[Friends] Now following:", toUser.name);

      const { data: theyFollowMe } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", toUser.id)
        .eq("friend_id", fromUser.id)
        .maybeSingle();

      if (theyFollowMe) {
        console.log("[Friends] Mutual follow detected! Creating conversation...");
        await ensureConversation(fromUser.id, fromUser.name, toUser.id, toUser.name);
      }

      return true;
    },
    onSuccess: () => {
      invalidate();
      delayedInvalidate(2000);
    },
  });

  const followBackMutation = useMutation({
    mutationFn: async (followerUserId: string) => {
      if (!currentUserId) return false;

      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("friend_id", followerUserId)
        .maybeSingle();

      if (existing) {
        console.log("[Friends] Already following back");
        return false;
      }

      const follower = dataRef.current.followers.find((f) => f.userId === followerUserId);
      const name = follower?.name ?? "Unknown";
      const email = follower?.email ?? "";

      const { error } = await supabase.from("friends").insert({
        user_id: currentUserId,
        friend_id: followerUserId,
        friend_name: name,
        friend_email: email,
        friend_avatar: follower?.avatar ?? null,
      });

      if (error) {
        console.warn("[Friends] Follow back error:", error.message);
        return false;
      }

      console.log("[Friends] Followed back:", name);

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", currentUserId)
        .maybeSingle();

      await ensureConversation(currentUserId, myProfile?.name ?? "", followerUserId, name);
      return true;
    },
    onSuccess: () => {
      invalidate();
      delayedInvalidate(2000);
    },
  });

  const sendFriendRequest = useCallback(
    async (fromUser: User, toUser: PublicUser) => {
      return sendFollowMutation.mutateAsync({ fromUser, toUser });
    },
    [sendFollowMutation]
  );

  const followBack = useCallback(
    async (followerUserId: string) => {
      return followBackMutation.mutateAsync(followerUserId);
    },
    [followBackMutation]
  );

  const acceptFriendRequest = useCallback(
    async (requestId: string, _userId: string) => {
      const req = dataRef.current.requests.find((r) => r.id === requestId);
      if (!req) return;

      console.log("[Friends] Accepting request:", requestId);

      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) {
        console.warn("[Friends] Accept error:", error.message);
        return;
      }

      const requesterId = req.fromUserId;
      const acceptorId = req.toUserId;

      const { data: existingFollow } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", requesterId)
        .eq("friend_id", acceptorId)
        .maybeSingle();

      if (!existingFollow) {
        await supabase.from("friends").insert({
          user_id: requesterId,
          friend_id: acceptorId,
          friend_name: req.toUserName,
          friend_email: req.toUserEmail,
        });
      }

      const { data: reverseFollow } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", acceptorId)
        .eq("friend_id", requesterId)
        .maybeSingle();

      if (!reverseFollow) {
        await supabase.from("friends").insert({
          user_id: acceptorId,
          friend_id: requesterId,
          friend_name: req.fromUserName,
          friend_email: req.fromUserEmail,
        });
      }

      await ensureConversation(requesterId, req.fromUserName, acceptorId, req.toUserName);

      console.log("[Friends] Request accepted, both directions created");
      invalidate();
      delayedInvalidate(2000);
    },
    [invalidate, delayedInvalidate]
  );

  const rejectFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", requestId);
      console.log("[Friends] Rejected request:", requestId);
      invalidate();
    },
    [invalidate]
  );

  const cancelFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase.from("friend_requests").delete().eq("id", requestId);
      console.log("[Friends] Cancelled request:", requestId);
      invalidate();
    },
    [invalidate]
  );

  const toggleCloseFriend = useCallback(
    async (friendId: string) => {
      const friend = dataRef.current.friends.find((f) => f.id === friendId);
      if (!friend) return;
      const newValue = !friend.isCloseFriend;
      console.log("[Friends] Toggle close friend:", friend.name, "=>", newValue);

      const { error } = await supabase
        .from("friends")
        .update({ is_close_friend: newValue })
        .eq("id", friendId);

      if (error) {
        console.warn("[Friends] Toggle close friend error:", error.message);
      }
      invalidate();
    },
    [invalidate]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      const friend = dataRef.current.friends.find((f) => f.id === friendId);
      if (!friend || !currentUserId) return;

      console.log("[Friends] Removing friend:", friend.name);

      await Promise.all([
        supabase.from("friends").delete().eq("user_id", currentUserId).eq("friend_id", friend.userId),
        supabase.from("friends").delete().eq("user_id", friend.userId).eq("friend_id", currentUserId),
      ]);

      console.log("[Friends] Removed friend:", friend.name);
      invalidate();
    },
    [currentUserId, invalidate]
  );

  const unfollowUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUserId) return;
      console.log("[Friends] Unfollowing user:", targetUserId);
      await supabase
        .from("friends")
        .delete()
        .eq("user_id", currentUserId)
        .eq("friend_id", targetUserId);
      invalidate();
    },
    [currentUserId, invalidate]
  );

  const closeFriends = useMemo(
    () => currentData.friends.filter((f) => f.isCloseFriend),
    [currentData.friends]
  );

  const isCloseFriend = useCallback(
    (userId: string) => dataRef.current.friends.some((f) => f.userId === userId && f.isCloseFriend),
    []
  );

  const isFriend = useCallback(
    (userId: string) => dataRef.current.friends.some((f) => f.userId === userId),
    []
  );

  const isFollowing = useCallback(
    (userId: string) => {
      const d = dataRef.current;
      return d.friends.some((f) => f.userId === userId) || d.following.some((f) => f.userId === userId);
    },
    []
  );

  const getPendingRequests = useCallback(
    (userId: string) => dataRef.current.requests.filter((r) => r.toUserId === userId && r.status === "pending"),
    []
  );

  const getSentRequests = useCallback(
    (userId: string) => dataRef.current.requests.filter((r) => r.fromUserId === userId && r.status === "pending"),
    []
  );

  const hasPendingRequest = useCallback(
    (fromUserId: string, toUserId: string) =>
      dataRef.current.requests.some(
        (r) =>
          ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
            (r.fromUserId === toUserId && r.toUserId === fromUserId)) &&
          r.status === "pending"
      ),
    []
  );

  const refetchUsers = useCallback(async () => {
    console.log("[Friends] Manual refetch");
    await dataQuery.refetch();
  }, [dataQuery]);

  const isRefetching = dataQuery.isRefetching || dataQuery.isLoading;

  return useMemo(
    () => ({
      friends: currentData.friends,
      followers: currentData.followers,
      following: currentData.following,
      closeFriends,
      requests: currentData.requests,
      registerUser,
      searchUsersFromSupabase,
      sendFriendRequest,
      followBack,
      acceptFriendRequest,
      rejectFriendRequest,
      cancelFriendRequest,
      toggleCloseFriend,
      removeFriend,
      unfollowUser,
      isCloseFriend,
      isFriend,
      isFollowing,
      getPendingRequests,
      getSentRequests,
      hasPendingRequest,
      refetchUsers,
      isRefetching,
    }),
    [
      currentData, closeFriends,
      registerUser, searchUsersFromSupabase, sendFriendRequest, followBack,
      acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
      toggleCloseFriend, removeFriend, unfollowUser, isCloseFriend, isFriend,
      isFollowing, getPendingRequests, getSentRequests, hasPendingRequest,
      refetchUsers, isRefetching,
    ]
  );
});
