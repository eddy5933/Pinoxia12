export type UserRole = "customer" | "owner";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  cuisine?: string;
  photos: string[];
  address: string;
  latitude: number;
  longitude: number;
  openingHours: OpeningHours;
  phone?: string;
  rating: number;
  reviewCount: number;
  priceRange: "$" | "$$" | "$$$";
  createdAt: string;
}

export interface OpeningHours {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface Review {
  id: string;
  restaurantId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type OnlineVisibility = "hidden" | "friends_only" | "everyone";

export type FriendStatus = "pending" | "accepted" | "rejected";

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  toUserId: string;
  toUserName: string;
  toUserEmail: string;
  status: FriendStatus;
  createdAt: string;
}

export interface Friend {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline?: boolean;
  isCloseFriend?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: "text" | "location";
  locationData?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  };
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}
