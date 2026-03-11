import { useState, useCallback, useMemo, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Friend, FriendRequest, User } from "@/types";

const FRIENDS_KEY = "foodspot_friends";
const REQUESTS_KEY = "foodspot_friend_requests";
const USERS_KEY = "foodspot_all_users";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
}

const MOCK_USERS: PublicUser[] = [
  { id: "user_demo_1", email: "alice@email.com", name: "Alice Chen", role: "customer" },
  { id: "user_demo_2", email: "bob@email.com", name: "Bob Martinez", role: "owner" },
  { id: "user_demo_3", email: "carol@email.com", name: "Carol Nguyen", role: "customer" },
  { id: "user_demo_4", email: "dave@email.com", name: "Dave Thompson", role: "owner" },
  { id: "user_demo_5", email: "emma@email.com", name: "Emma Wilson", role: "customer" },
  { id: "user_demo_6", email: "frank@email.com", name: "Frank Lee", role: "customer" },
  { id: "user_demo_7", email: "grace@email.com", name: "Grace Kim", role: "owner" },
  { id: "user_demo_8", email: "henry@email.com", name: "Henry Patel", role: "customer" },
];

export const [FriendsProvider, useFriends] = createContextHook(() => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUser[]>(MOCK_USERS);

  const loadQuery = useQuery({
    queryKey: ["friends_load"],
    queryFn: async () => {
      console.log("[FriendsProvider] Loading data...");
      const [storedFriends, storedRequests, storedUsers] = await Promise.all([
        AsyncStorage.getItem(FRIENDS_KEY),
        AsyncStorage.getItem(REQUESTS_KEY),
        AsyncStorage.getItem(USERS_KEY),
      ]);

      const loadedFriends: Friend[] = storedFriends ? JSON.parse(storedFriends) : [];
      const loadedRequests: FriendRequest[] = storedRequests ? JSON.parse(storedRequests) : [];
      const loadedUsers: PublicUser[] = storedUsers ? JSON.parse(storedUsers) : MOCK_USERS;

      if (!storedUsers) {
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
      }

      console.log("[FriendsProvider] Loaded", loadedFriends.length, "friends,", loadedRequests.length, "requests");
      return { friends: loadedFriends, requests: loadedRequests, users: loadedUsers };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (loadQuery.data) {
      setFriends(loadQuery.data.friends);
      setRequests(loadQuery.data.requests);
      setAllUsers(loadQuery.data.users);
    }
  }, [loadQuery.data]);

  const persistFriends = useMutation({
    mutationFn: async (updated: Friend[]) => {
      await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
    },
  });

  const persistRequests = useMutation({
    mutationFn: async (updated: FriendRequest[]) => {
      await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
    },
  });

  const registerUser = useCallback(async (user: User) => {
    const exists = allUsers.find((u) => u.id === user.id);
    if (!exists) {
      const newUser: PublicUser = { id: user.id, email: user.email, name: user.name, role: user.role };
      const updated = [...allUsers, newUser];
      setAllUsers(updated);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
      console.log("[FriendsProvider] Registered user:", user.name, "role:", user.role);
    } else if (exists.role !== user.role || exists.name !== user.name || exists.email !== user.email) {
      const updated = allUsers.map((u) =>
        u.id === user.id ? { ...u, name: user.name, email: user.email, role: user.role } : u
      );
      setAllUsers(updated);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
      console.log("[FriendsProvider] Updated user profile:", user.name, "role:", user.role);
    }
  }, [allUsers]);

  const searchUsers = useCallback(
    (query: string, currentUserId: string) => {
      if (!query.trim()) return [];
      const q = query.toLowerCase();
      return allUsers.filter(
        (u) =>
          u.id !== currentUserId &&
          (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role === "owner" && "business".includes(q)))
      );
    },
    [allUsers]
  );

  const sendFriendRequest = useCallback(
    (fromUser: User, toUser: PublicUser) => {
      const existing = requests.find(
        (r) =>
          (r.fromUserId === fromUser.id && r.toUserId === toUser.id) ||
          (r.fromUserId === toUser.id && r.toUserId === fromUser.id)
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

      const newRequest: FriendRequest = {
        id: `fr_${Date.now()}`,
        fromUserId: fromUser.id,
        fromUserName: fromUser.name,
        fromUserEmail: fromUser.email,
        toUserId: toUser.id,
        toUserName: toUser.name,
        toUserEmail: toUser.email,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const updated = [newRequest, ...requests];
      setRequests(updated);
      persistRequests.mutate(updated);
      console.log("[FriendsProvider] Sent friend request to", toUser.name);
      return true;
    },
    [requests, friends, persistRequests]
  );

  const acceptFriendRequest = useCallback(
    (requestId: string, currentUserId: string) => {
      const req = requests.find((r) => r.id === requestId);
      if (!req) return;

      const updatedRequests = requests.map((r) =>
        r.id === requestId ? { ...r, status: "accepted" as const } : r
      );
      setRequests(updatedRequests);
      persistRequests.mutate(updatedRequests);

      const otherUserId = req.fromUserId === currentUserId ? req.toUserId : req.fromUserId;
      const otherUserName = req.fromUserId === currentUserId ? req.toUserName : req.fromUserName;
      const otherUserEmail = req.fromUserId === currentUserId ? req.toUserEmail : req.fromUserEmail;

      const newFriend: Friend = {
        id: `friend_${Date.now()}`,
        userId: otherUserId,
        name: otherUserName,
        email: otherUserEmail,
        isOnline: true,
      };
      const updatedFriends = [newFriend, ...friends];
      setFriends(updatedFriends);
      persistFriends.mutate(updatedFriends);
      console.log("[FriendsProvider] Accepted request from", otherUserName);
    },
    [requests, friends, persistRequests, persistFriends]
  );

  const rejectFriendRequest = useCallback(
    (requestId: string) => {
      const updated = requests.map((r) =>
        r.id === requestId ? { ...r, status: "rejected" as const } : r
      );
      setRequests(updated);
      persistRequests.mutate(updated);
      console.log("[FriendsProvider] Rejected request", requestId);
    },
    [requests, persistRequests]
  );

  const removeFriend = useCallback(
    (friendId: string) => {
      const updated = friends.filter((f) => f.id !== friendId);
      setFriends(updated);
      persistFriends.mutate(updated);
      console.log("[FriendsProvider] Removed friend", friendId);
    },
    [friends, persistFriends]
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

  return useMemo(
    () => ({
      friends,
      requests,
      allUsers,
      registerUser,
      searchUsers,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      getPendingRequests,
      getSentRequests,
      isFriend,
      hasPendingRequest,
    }),
    [
      friends, requests, allUsers, registerUser, searchUsers,
      sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
      removeFriend, getPendingRequests, getSentRequests, isFriend, hasPendingRequest,
    ]
  );
});
