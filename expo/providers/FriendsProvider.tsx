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

interface FriendsQueryData {
  friends: Friend[];
  followers: Friend[];
  requests: FriendRequest[];
  users: PublicUser[];
}

const emptyData: FriendsQueryData = {
  friends: [],
  followers: [],
  requests: [],
  users: [],
};

export const [FriendsProvider, useFriends] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadQuery = useQuery({
    queryKey: ["friends_load", currentUserId],
    queryFn: async (): Promise<FriendsQueryData> => {
      console.log("[FriendsProvider] Loading data from Supabase for user:", currentUserId);

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[FriendsProvider] Current session:", session ? session.user.id : "none");

      const [profilesRes, friendsRes, requestsRes, followersRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        currentUserId
          ? supabase.from("friends").select("*, profile:profiles!friends_friend_id_fkey(*)").eq("user_id", currentUserId)
          : Promise.resolve({ data: [] as any[], error: null }),
        currentUserId
          ? supabase.from("friend_requests").select("*").or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
          : Promise.resolve({ data: [] as any[], error: null }),
        currentUserId
          ? supabase.from("friends").select("*").eq("friend_id", currentUserId)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      let friendsData = friendsRes.data;
      if (friendsRes.error && friendsRes.error.message?.includes("friend_id_fkey")) {
        console.log("[FriendsProvider] JOIN failed, falling back to plain friends query");
        const fallback = await supabase.from("friends").select("*").eq("user_id", currentUserId);
        friendsData = fallback.data;
      }

      if (followersRes.error) {
        console.warn("[FriendsProvider] Followers query error:", followersRes.error.message);
      }
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

      const loadedFriends: Friend[] = (friendsData ?? []).map((f: any) => {
        const profile = f.profile;
        return {
          id: f.id,
          userId: f.friend_id,
          name: profile?.name ?? f.friend_name,
          email: profile?.email ?? f.friend_email,
          avatar: profile?.avatar ?? f.friend_avatar ?? undefined,
          isOnline: true,
          isCloseFriend: f.is_close_friend ?? false,
        };
      });

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

      const myFollowingIds = new Set((friendsData ?? []).map((f: any) => f.friend_id));
      const loadedFollowers: Friend[] = (followersRes.data ?? [])
        .filter((f: any) => !myFollowingIds.has(f.user_id))
        .map((f: any) => {
          const profile = loadedUsers.find((u) => u.id === f.user_id);
          return {
            id: f.id,
            userId: f.user_id,
            name: profile?.name ?? f.friend_name ?? "Unknown",
            email: profile?.email ?? f.friend_email ?? "",
            avatar: profile?.avatar ?? undefined,
            isOnline: true,
            isCloseFriend: false,
          };
        });

      console.log("[FriendsProvider] Loaded", loadedUsers.length, "users,", loadedFriends.length, "friends,", loadedFollowers.length, "followers,", loadedRequests.length, "requests");
      return { friends: loadedFriends, followers: loadedFollowers, requests: loadedRequests, users: loadedUsers };
    },
    enabled: !!currentUserId,
    staleTime: 1000,
    refetchInterval: 10000,
  });

  const queryData = loadQuery.data ?? emptyData;
  const friends = queryData.friends;
  const followers = queryData.followers;
  const requests = queryData.requests;
  const allUsers = queryData.users;

  const updateCache = useCallback(
    (updater: (old: FriendsQueryData) => FriendsQueryData) => {
      queryClient.setQueryData<FriendsQueryData>(["friends_load", currentUserId], (old) => {
        if (!old) return old;
        return updater(old);
      });
    },
    [queryClient, currentUserId]
  );

  const forceRefetch = useCallback(() => {
    console.log("[FriendsProvider] Force refetch executing");
    void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
    void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
  }, [queryClient, currentUserId]);

  const delayedRefetch = useCallback(
    (delayMs: number = 1500) => {
      setTimeout(() => {
        console.log("[FriendsProvider] Delayed refetch executing after", delayMs, "ms");
        void queryClient.invalidateQueries({ queryKey: ["friends_load", currentUserId] });
        void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
      }, delayMs);
    },
    [queryClient, currentUserId]
  );

  useEffect(() => {
    if (!currentUserId) return;
    console.log("[FriendsProvider] Setting up realtime subscriptions");

    const channel = supabase
      .channel(`friends_realtime_${currentUserId}`)
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

          updateCache((old) => {
            if (old.requests.some((req) => req.id === newReq.id)) return old;
            return { ...old, requests: [newReq, ...old.requests] };
          });
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "friend_requests" },
        async (payload: any) => {
          console.log("[FriendsProvider] Realtime updated friend_request:", payload.new?.id, "status:", payload.new?.status);
          const r = payload.new;
          if (!r) return;
          if (r.from_user_id !== currentUserId && r.to_user_id !== currentUserId) return;

          updateCache((old) => ({
            ...old,
            requests: old.requests.map((req) =>
              req.id === r.id ? { ...req, status: r.status } : req
            ),
          }));

          if (r.status === "accepted") {
            console.log("[FriendsProvider] Friend request accepted via realtime, current user:", currentUserId);

            const isRequester = r.from_user_id === currentUserId;
            const otherUserId = isRequester ? r.to_user_id : r.from_user_id;
            const otherUserName = isRequester ? r.to_user_name : r.from_user_name;
            const otherUserEmail = isRequester ? r.to_user_email : r.from_user_email;

            const { data: freshProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", otherUserId)
              .maybeSingle();

            const newFriend: Friend = {
              id: `temp_${Date.now()}`,
              userId: otherUserId,
              name: freshProfile?.name ?? otherUserName,
              email: freshProfile?.email ?? otherUserEmail,
              avatar: freshProfile?.avatar ?? undefined,
              isOnline: true,
              isCloseFriend: false,
            };

            updateCache((old) => {
              if (old.friends.some((f) => f.userId === otherUserId)) return old;
              console.log("[FriendsProvider] Realtime: adding friend to cache:", newFriend.name);
              return {
                ...old,
                friends: [newFriend, ...old.friends],
                followers: old.followers.filter((fl) => fl.userId !== otherUserId),
              };
            });

            forceRefetch();
            delayedRefetch(3000);
          }
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "friends" },
        async (payload: any) => {
          console.log("[FriendsProvider] Realtime new friend row:", payload.new?.id, "user_id:", payload.new?.user_id, "friend_id:", payload.new?.friend_id);
          const f = payload.new;
          if (!f) return;

          if (f.user_id === currentUserId) {
            const { data: friendProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", f.friend_id)
              .maybeSingle();

            const newFriend: Friend = {
              id: f.id,
              userId: f.friend_id,
              name: friendProfile?.name ?? f.friend_name,
              email: friendProfile?.email ?? f.friend_email,
              avatar: friendProfile?.avatar ?? f.friend_avatar ?? undefined,
              isOnline: true,
              isCloseFriend: f.is_close_friend ?? false,
            };

            updateCache((old) => {
              const alreadyFriend = old.friends.some((fr) => fr.id === newFriend.id || fr.userId === newFriend.userId);
              if (alreadyFriend) return old;
              console.log("[FriendsProvider] Realtime: adding friend:", newFriend.name);
              return {
                ...old,
                friends: [newFriend, ...old.friends],
                followers: old.followers.filter((fl) => fl.userId !== f.friend_id),
              };
            });

            forceRefetch();
          }

          if (f.friend_id === currentUserId && f.user_id !== currentUserId) {
            console.log("[FriendsProvider] Someone followed me:", f.user_id, "- checking if mutual");

            const iMutual = await supabase
              .from("friends")
              .select("id")
              .eq("user_id", currentUserId)
              .eq("friend_id", f.user_id)
              .maybeSingle();

            if (iMutual.data) {
              console.log("[FriendsProvider] Mutual follow detected with:", f.user_id);

              const currentAllUsers = queryClient.getQueryData<FriendsQueryData>(["friends_load", currentUserId])?.users ?? [];
              const profile = currentAllUsers.find((u) => u.id === f.user_id);

              updateCache((old) => {
                const updatedFollowers = old.followers.filter((fl) => fl.userId !== f.user_id);
                const alreadyFriend = old.friends.some((fr) => fr.userId === f.user_id);
                let updatedFriends = old.friends;
                if (!alreadyFriend) {
                  const mutualFriend: Friend = {
                    id: iMutual.data?.id ?? `mutual_${Date.now()}`,
                    userId: f.user_id,
                    name: profile?.name ?? f.friend_name ?? "Unknown",
                    email: profile?.email ?? f.friend_email ?? "",
                    avatar: profile?.avatar ?? undefined,
                    isOnline: true,
                    isCloseFriend: false,
                  };
                  console.log("[FriendsProvider] Realtime: adding mutual friend:", mutualFriend.name);
                  updatedFriends = [mutualFriend, ...old.friends];
                }
                return { ...old, friends: updatedFriends, followers: updatedFollowers };
              });

              const { data: existingConvo } = await supabase
                .from("conversations")
                .select("id")
                .contains("participants", [currentUserId])
                .contains("participants", [f.user_id])
                .maybeSingle();

              if (!existingConvo) {
                const { data: myProfile } = await supabase
                  .from("profiles")
                  .select("name")
                  .eq("id", currentUserId)
                  .maybeSingle();

                const participantNames: Record<string, string> = {
                  [currentUserId]: myProfile?.name ?? "",
                  [f.user_id]: f.friend_name ?? "",
                };

                await supabase.from("conversations").insert({
                  participants: [currentUserId, f.user_id],
                  participant_names: participantNames,
                  unread_count: 0,
                });
                console.log("[FriendsProvider] Created conversation for mutual follow");
              }

              void queryClient.invalidateQueries({ queryKey: ["chat_conversations", currentUserId] });
              forceRefetch();
            } else {
              const { data: followerProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", f.user_id)
                .maybeSingle();

              const newFollower: Friend = {
                id: f.id,
                userId: f.user_id,
                name: followerProfile?.name ?? f.friend_name ?? "Unknown",
                email: followerProfile?.email ?? f.friend_email ?? "",
                avatar: followerProfile?.avatar ?? undefined,
                isOnline: true,
                isCloseFriend: false,
              };

              updateCache((old) => {
                if (old.followers.some((fl) => fl.userId === f.user_id)) return old;
                console.log("[FriendsProvider] Realtime: new follower:", newFollower.name);
                return { ...old, followers: [newFollower, ...old.followers] };
              });
            }
          }

          forceRefetch();
          delayedRefetch(3000);
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: any) => {
          const p = payload.new;
          if (!p) return;
          console.log("[FriendsProvider] Realtime profile update:", p.id, p.name);
          updateCache((old) => ({
            ...old,
            friends: old.friends.map((f) =>
              f.userId === p.id
                ? { ...f, name: p.name, email: p.email, avatar: p.avatar ?? undefined }
                : f
            ),
            users: old.users.map((u) =>
              u.id === p.id
                ? { ...u, name: p.name, email: p.email, role: p.role ?? u.role, avatar: p.avatar ?? undefined }
                : u
            ),
          }));
        }
      )
      .subscribe((status: string) => {
        console.log("[FriendsProvider] Realtime subscription status:", status);
      });

    return () => {
      console.log("[FriendsProvider] Cleaning up realtime subscription");
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, queryClient, updateCache, delayedRefetch, forceRefetch]);

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
    (query: string, userId: string) => {
      const filtered = allUsers.filter((u) => u.id !== userId);
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

        updateCache((old) => ({
          ...old,
          friends: [newFriend, ...old.friends],
        }));

        console.log("[FriendsProvider] Friend added successfully:", toUser.name);
      }

      delayedRefetch(1500);
      return true;
    },
    [friends, updateCache, delayedRefetch]
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

      updateCache((old) => ({
        ...old,
        requests: [newRequest, ...old.requests],
      }));

      console.log("[FriendsProvider] Sent friend request to", toUser.name);
      return true;
    },
    [requests, friends, updateCache]
  );

  const acceptFriendRequest = useCallback(
    async (requestId: string, userId: string) => {
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

      updateCache((old) => ({
        ...old,
        requests: old.requests.map((r) =>
          r.id === requestId ? { ...r, status: "accepted" as const } : r
        ),
      }));

      const requesterId = req.fromUserId;
      const acceptorId = req.toUserId;

      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", requesterId)
        .maybeSingle();

      const { data: acceptorProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", acceptorId)
        .maybeSingle();

      const requesterName = requesterProfile?.name ?? req.fromUserName;
      const requesterEmail = requesterProfile?.email ?? req.fromUserEmail;
      const acceptorName = acceptorProfile?.name ?? req.toUserName;
      const acceptorEmail = acceptorProfile?.email ?? req.toUserEmail;

      console.log("[FriendsProvider] Accept: requester:", requesterName, "(", requesterId, ") acceptor:", acceptorName, "(", acceptorId, ")");

      const { data: existingFollow } = await supabase
        .from("friends")
        .select("*")
        .eq("user_id", requesterId)
        .eq("friend_id", acceptorId)
        .maybeSingle();

      if (!existingFollow) {
        const { error: e1 } = await supabase
          .from("friends")
          .insert({
            user_id: requesterId,
            friend_id: acceptorId,
            friend_name: acceptorName,
            friend_email: acceptorEmail,
            friend_avatar: acceptorProfile?.avatar ?? null,
          });
        if (e1) {
          console.warn("[FriendsProvider] Insert requester follow row error:", e1.message);
        } else {
          console.log("[FriendsProvider] Requester now follows acceptor");
        }
      }

      if (userId === acceptorId) {
        const newFollower: Friend = {
          id: `follower_${Date.now()}`,
          userId: requesterId,
          name: requesterName,
          email: requesterEmail,
          avatar: requesterProfile?.avatar ?? undefined,
          isOnline: true,
          isCloseFriend: false,
        };

        updateCache((old) => {
          if (old.followers.some((f) => f.userId === requesterId)) return old;
          console.log("[FriendsProvider] Adding new follower to cache:", requesterName);
          return { ...old, followers: [newFollower, ...old.followers] };
        });
      } else if (userId === requesterId) {
        const newFriend: Friend = {
          id: `friend_${Date.now()}`,
          userId: acceptorId,
          name: acceptorName,
          email: acceptorEmail,
          avatar: acceptorProfile?.avatar ?? undefined,
          isOnline: true,
          isCloseFriend: false,
        };

        updateCache((old) => {
          if (old.friends.some((f) => f.userId === acceptorId)) return old;
          return { ...old, friends: [newFriend, ...old.friends] };
        });
      }

      console.log("[FriendsProvider] Accepted request - scheduling refetch");
      forceRefetch();
      delayedRefetch(3000);
    },
    [requests, updateCache, delayedRefetch, forceRefetch]
  );

  const rejectFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      updateCache((old) => ({
        ...old,
        requests: old.requests.map((r) =>
          r.id === requestId ? { ...r, status: "rejected" as const } : r
        ),
      }));
      console.log("[FriendsProvider] Rejected request", requestId);
    },
    [updateCache]
  );

  const cancelFriendRequest = useCallback(
    async (requestId: string) => {
      await supabase.from("friend_requests").delete().eq("id", requestId);
      updateCache((old) => ({
        ...old,
        requests: old.requests.filter((r) => r.id !== requestId),
      }));
      console.log("[FriendsProvider] Cancelled request", requestId);
    },
    [updateCache]
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

      updateCache((old) => ({
        ...old,
        friends: old.friends.map((f) =>
          f.id === friendId ? { ...f, isCloseFriend: newValue } : f
        ),
      }));

      const { error } = await supabase
        .from("friends")
        .update({ is_close_friend: newValue })
        .eq("id", friendId);

      if (error) {
        console.warn("[FriendsProvider] Toggle close friend error:", error.message);
        updateCache((old) => ({
          ...old,
          friends: old.friends.map((f) =>
            f.id === friendId ? { ...f, isCloseFriend: !newValue } : f
          ),
        }));
      } else {
        console.log("[FriendsProvider] Close friend saved successfully:", friend.name, "=>", newValue);
        delayedRefetch(1500);
      }
    },
    [friends, queryClient, currentUserId, updateCache, delayedRefetch]
  );

  const followBack = useCallback(
    async (followerUserId: string) => {
      if (!currentUserId) return false;
      console.log("[FriendsProvider] Following back user:", followerUserId);

      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("friend_id", followerUserId)
        .maybeSingle();

      if (existing) {
        console.log("[FriendsProvider] Already following this user");
        return false;
      }

      const follower = followers.find((f) => f.userId === followerUserId);
      const profile = allUsers.find((u) => u.id === followerUserId);
      const name = profile?.name ?? follower?.name ?? "Unknown";
      const email = profile?.email ?? follower?.email ?? "";
      const avatar = profile?.avatar ?? follower?.avatar ?? undefined;

      const { data: row, error } = await supabase
        .from("friends")
        .insert({
          user_id: currentUserId,
          friend_id: followerUserId,
          friend_name: name,
          friend_email: email,
          friend_avatar: avatar ?? null,
        })
        .select()
        .single();

      if (error) {
        console.warn("[FriendsProvider] Follow back error:", error.message);
        return false;
      }

      const newFriend: Friend = {
        id: row?.id ?? `fb_${Date.now()}`,
        userId: followerUserId,
        name,
        email,
        avatar,
        isOnline: true,
        isCloseFriend: false,
      };

      console.log("[FriendsProvider] followBack: optimistically updating cache with friend:", name);
      updateCache((old) => {
        const alreadyInFriends = old.friends.some((f) => f.userId === followerUserId);
        return {
          ...old,
          friends: alreadyInFriends ? old.friends : [newFriend, ...old.friends],
          followers: old.followers.filter((f) => f.userId !== followerUserId),
        };
      });

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .maybeSingle();

      const myName = myProfile?.name ?? "";

      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .contains("participants", [currentUserId])
        .contains("participants", [followerUserId])
        .maybeSingle();

      if (!existingConvo) {
        const participantNames: Record<string, string> = {
          [currentUserId]: myName,
          [followerUserId]: name,
        };
        await supabase
          .from("conversations")
          .insert({
            participants: [currentUserId, followerUserId],
            participant_names: participantNames,
            unread_count: 0,
          });
        console.log("[FriendsProvider] Created conversation after follow back");
      }

      forceRefetch();
      delayedRefetch(2000);
      delayedRefetch(5000);

      console.log("[FriendsProvider] Followed back:", name);
      return true;
    },
    [currentUserId, followers, allUsers, updateCache, delayedRefetch, forceRefetch]
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

      updateCache((old) => ({
        ...old,
        friends: old.friends.filter((f) => f.id !== friendId),
      }));

      await supabase.from("friends").delete().eq("id", friendId);
      if (friend) {
        await supabase
          .from("friends")
          .delete()
          .eq("friend_id", friend.userId)
          .or(`user_id.eq.${friend.userId}`);
      }
      console.log("[FriendsProvider] Removed friend", friendId);
      delayedRefetch(1500);
    },
    [friends, updateCache, delayedRefetch]
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
      followers,
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
      followBack,
      isCloseFriend,
      getPendingRequests,
      getSentRequests,
      isFriend,
      hasPendingRequest,
      refetchUsers,
      isRefetching,
    }),
    [
      friends, followers, closeFriends, requests, allUsers, registerUser, searchUsers,
      searchUsersFromSupabase, sendFriendRequest, addFriendDirectly, acceptFriendRequest, rejectFriendRequest,
      removeFriend, cancelFriendRequest, toggleCloseFriend, followBack, isCloseFriend,
      getPendingRequests, getSentRequests,
      isFriend, hasPendingRequest, refetchUsers, isRefetching,
    ]
  );
});
