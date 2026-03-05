import { create } from "zustand";
import type { AuthState, AuthUser } from "@/types/auth";
import { apiClient } from "@/services/api";

const TOKEN_KEY = "smart_geci_token";

interface LoginApiResponse {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
}

/**
 * Reads the stored JWT from localStorage and extracts the role from its
 * payload so the app can restore the session on page load without a
 * round-trip to the backend.
 */
function initFromStorage(): {
  role: "guest" | "authorized" | "admin";
  user: AuthUser | null;
  token: string | null;
} {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { role: "guest", user: null, token: null };
    const parts = token.split(".");
    if (parts.length !== 3) return { role: "guest", user: null, token: null };
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.role === "authorized" || payload.role === "admin") {
      return { role: payload.role as "authorized" | "admin", user: null, token };
    }
  } catch {
    /* malformed token — fall through to guest */
  }
  return { role: "guest", user: null, token: null };
}

const initial = initFromStorage();

export const useAuthStore = create<AuthState>((set, get) => ({
  role: initial.role,
  user: initial.user,
  token: initial.token,

  login: async (username: string, password: string) => {
    const response = await apiClient.post<LoginApiResponse>("/auth/login", {
      username,
      password,
    });
    const { token, user } = response.data.data;
    localStorage.setItem(TOKEN_KEY, token);
    set({ role: user.role, user, token });
  },

  loginAsAuthorized: () => set({ role: "authorized", user: null, token: null }),

  loginAsAdmin: () => set({ role: "admin", user: null, token: null }),

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ role: "guest", user: null, token: null });
  },

  isAuthenticated: () => {
    const { role } = get();
    return role === "authorized" || role === "admin";
  },

  isAdmin: () => get().role === "admin",
}));
