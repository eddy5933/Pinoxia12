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
