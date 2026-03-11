const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (!url) {
    console.warn("[API] EXPO_PUBLIC_RORK_API_BASE_URL is not set");
    return "";
  }
  return url;
};

export interface CloudUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  updatedAt: string;
}

export const cloudUsersApi = {
  upsert: async (user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
  }): Promise<{ success: boolean; user: CloudUser }> => {
    const base = getBaseUrl();
    if (!base) {
      console.log("[API] No base URL, skipping upsert");
      return { success: false, user: { ...user, updatedAt: new Date().toISOString() } };
    }
    try {
      console.log("[API] Upserting user:", user.name, user.id);
      const res = await fetch(`${base}/api/users/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!res.ok) {
        console.warn("[API] Upsert failed:", res.status);
        return { success: false, user: { ...user, updatedAt: new Date().toISOString() } };
      }
      const data = await res.json();
      console.log("[API] Upsert success:", data?.user?.name);
      return data;
    } catch (e) {
      console.warn("[API] Upsert error:", e);
      return { success: false, user: { ...user, updatedAt: new Date().toISOString() } };
    }
  },

  getAll: async (): Promise<CloudUser[]> => {
    const base = getBaseUrl();
    if (!base) {
      console.log("[API] No base URL, returning empty");
      return [];
    }
    try {
      console.log("[API] Fetching all users...");
      const res = await fetch(`${base}/api/users`);
      if (!res.ok) {
        console.warn("[API] getAll failed:", res.status);
        return [];
      }
      const data = await res.json();
      console.log("[API] Fetched", data?.length ?? 0, "users from cloud");
      return data ?? [];
    } catch (e) {
      console.warn("[API] getAll error:", e);
      return [];
    }
  },

  search: async (query: string, excludeId?: string): Promise<CloudUser[]> => {
    const base = getBaseUrl();
    if (!base) return [];
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (excludeId) params.set("excludeId", excludeId);
      const res = await fetch(`${base}/api/users/search?${params.toString()}`);
      if (!res.ok) return [];
      return (await res.json()) ?? [];
    } catch (e) {
      console.warn("[API] search error:", e);
      return [];
    }
  },

  remove: async (id: string): Promise<boolean> => {
    const base = getBaseUrl();
    if (!base) return false;
    try {
      const res = await fetch(`${base}/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.success ?? false;
    } catch (e) {
      console.warn("[API] remove error:", e);
      return false;
    }
  },
};
