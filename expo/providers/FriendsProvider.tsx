import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Friend, FriendRequest, User } from "@/types";
import { supabase } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/pushNotifications";

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
        isFamily: row.is_family ?? false,
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
      isFamily: false,
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
      isFamily: false,
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

      const pattern = `%${q}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", userId)
        .or(`name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(50);

      if (error) {
        console.warn("[Friends] Search error:", error.message, error.code, error.details);

        console.log("[Friends] Falling back to name-only search");
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("*")
          .neq("id", userId)
          .ilike("name", pattern)
          .limit(50);

        if (fallbackError) {
          console.warn("[Friends] Fallback search error:", fallbackError.message);
          return [];
        }

        console.log("[Friends] Fallback results:", fallbackData?.length ?? 0);
        return (fallbackData ?? []).map((p: any) => ({
          id: p.id,
          email: p.email ?? "",
          name: p.name ?? "Unknown",
          role: p.role ?? "customer",
          avatar: p.avatar ?? undefined,
        }));
      }

      console.log("[Friends] Search results:", data?.length ?? 0);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        email: p.email ?? "",
        name: p.name ?? "Unknown",
        role: p.role ?? "customer",
        avatar: p.avatar ?? undefined,
      }));
    },
    []
  );

  const sendFollowMutation = useMutation({
    mutationFn: async ({ fromUser, toUser }: { fromUser: User; toUser: PublicUser }) => {
      console.log("[Friends] Attempting to follow:", toUser.name, "(", toUser.id, ") from:", fromUser.name, "(", fromUser.id, ")");

      const { data: existing, error: checkError } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", fromUser.id)
        .eq("friend_id", toUser.id)
        .maybeSingle();

      if (checkError) {
        console.warn("[Friends] Check existing follow error:", checkError.message, checkError.code, checkError.details);
        throw new Error(`Failed to check follow status: ${checkError.message}`);
      }

      if (existing) {
        console.log("[Friends] Already following:", toUser.name);
        return { success: false, reason: "already_following" as const };
      }

      const insertPayload = {
        user_id: fromUser.id,
        friend_id: toUser.id,
        friend_name: toUser.name,
        friend_email: toUser.email,
        friend_avatar: toUser.avatar ?? null,
      };
      console.log("[Friends] Inserting follow:", JSON.stringify(insertPayload));

      const { data: insertData, error } = await supabase
        .from("friends")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        console.warn("[Friends] Follow insert error:", error.message, error.code, error.details, error.hint);
        throw new Error(`Failed to follow: ${error.message}`);
      }

      console.log("[Friends] Now following:", toUser.name, "row id:", insertData?.id);

      try {
        await sendPushToUser(toUser.id, "New Follower", `${fromUser.name} started following you`, {
          type: "follow",
          userId: fromUser.id,
          userName: fromUser.name,
        });
        console.log("[Friends] Push notification sent to:", toUser.name);
      } catch (pushErr) {
        console.warn("[Friends] Push notification failed (non-critical):", pushErr);
      }

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

      return { success: true, reason: "followed" as const };
    },
    onSuccess: () => {
      invalidate();
      delayedInvalidate(2000);
    },
    onError: (error) => {
      console.warn("[Friends] Follow mutation error:", error.message);
    },
  });

  const followBackMutation = useMutation({
    mutationFn: async (followerUserId: string) => {
      if (!currentUserId) throw new Error("Not logged in");

      console.log("[Friends] Attempting follow back for:", followerUserId);

      const { data: existing, error: checkError } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("friend_id", followerUserId)
        .maybeSingle();

      if (checkError) {
        console.warn("[Friends] Check follow back error:", checkError.message);
        throw new Error(`Failed to check follow status: ${checkError.message}`);
      }

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
        console.warn("[Friends] Follow back insert error:", error.message, error.code, error.details);
        throw new Error(`Failed to follow back: ${error.message}`);
      }

      console.log("[Friends] Followed back:", name);

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", currentUserId)
        .maybeSingle();

      const myName = myProfile?.name ?? "";

      try {
        await sendPushToUser(followerUserId, "New Friend!", `${myName} followed you back! You are now friends.`, {
          type: "follow_back",
          userId: currentUserId,
          userName: myName,
        });
      } catch (pushErr) {
        console.warn("[Friends] Push for follow back failed (non-critical):", pushErr);
      }

      await ensureConversation(currentUserId, myName, followerUserId, name);
      return true;
    },
    onSuccess: () => {
      invalidate();
      delayedInvalidate(2000);
    },
    onError: (error) => {
      console.warn("[Friends] Follow back mutation error:", error.message);
    },
  });

  const sendFriendRequest = useCallback(
    async (fromUser: User, toUser: PublicUser): Promise<{ success: boolean; reason: string; error?: string }> => {
      try {
        const result = await sendFollowMutation.mutateAsync({ fromUser, toUser });
        return { success: result.success, reason: result.reason };
      } catch (err: any) {
        console.warn("[Friends] sendFriendRequest caught error:", err?.message);
        return { success: false, reason: "error", error: err?.message ?? "Unknown error" };
      }
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

      const updateData: Record<string, boolean> = { is_close_friend: newValue };
      if (newValue && friend.isFamily) {
        updateData.is_family = false;
      }

      const { error } = await supabase
        .from("friends")
        .update(updateData)
        .eq("id", friendId);

      if (error) {
        console.warn("[Friends] Toggle close friend error:", error.message);
      }
      invalidate();
    },
    [invalidate]
  );

  const toggleFamily = useCallback(
    async (friendId: string) => {
      const friend = dataRef.current.friends.find((f) => f.id === friendId);
      if (!friend) {
        console.warn("[Friends] toggleFamily: friend not found for id:", friendId);
        return;
      }
      const newValue = !friend.isFamily;
      console.log("[Friends] Toggle family:", friend.name, "=>", newValue, "row id:", friendId, "userId:", friend.userId);

      const updateData: Record<string, boolean> = { is_family: newValue };
      if (newValue && friend.isCloseFriend) {
        updateData.is_close_friend = false;
      }

      const { error } = await supabase
        .from("friends")
        .update(updateData)
        .eq("id", friendId);

      if (error) {
        console.warn("[Friends] Toggle family error by id:", error.message);
        if (currentUserId) {
          console.log("[Friends] Retrying toggle family by user_id + friend_id");
          const { error: err2 } = await supabase
            .from("friends")
            .update(updateData)
            .eq("user_id", currentUserId)
            .eq("friend_id", friend.userId);
          if (err2) {
            console.warn("[Friends] Toggle family fallback error:", err2.message);
          } else {
            console.log("[Friends] Toggle family fallback success");
          }
        }
      } else {
        console.log("[Friends] Toggle family success");
      }

      invalidate();
      delayedInvalidate(1500);
    },
    [invalidate, delayedInvalidate, currentUserId]
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

  const familyMembers = useMemo(
    () => currentData.friends.filter((f) => f.isFamily),
    [currentData.friends]
  );

  const isCloseFriend = useCallback(
    (userId: string) => dataRef.current.friends.some((f) => f.userId === userId && f.isCloseFriend),
    []
  );

  const isFamilyMember = useCallback(
    (userId: string) => dataRef.current.friends.some((f) => f.userId === userId && f.isFamily),
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
      familyMembers,
      requests: currentData.requests,
      registerUser,
      searchUsersFromSupabase,
      sendFriendRequest,
      followBack,
      acceptFriendRequest,
      rejectFriendRequest,
      cancelFriendRequest,
      toggleCloseFriend,
      toggleFamily,
      removeFriend,
      unfollowUser,
      isCloseFriend,
      isFamilyMember,
      isFriend,
      isFollowing,
      getPendingRequests,
      getSentRequests,
      hasPendingRequest,
      refetchUsers,
      isRefetching,
    }),
    [
      currentData, closeFriends, familyMembers,
      registerUser, searchUsersFromSupabase, sendFriendRequest, followBack,
      acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
      toggleCloseFriend, toggleFamily, removeFriend, unfollowUser,
      isCloseFriend, isFamilyMember, isFriend,
      isFollowing, getPendingRequests, getSentRequests, hasPendingRequest,
      refetchUsers, isRefetching,
    ]
  );
});
