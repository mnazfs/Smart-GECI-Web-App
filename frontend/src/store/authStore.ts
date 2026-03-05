import { create } from "zustand";
import type { AuthState } from "@/types/auth";

export const useAuthStore = create<AuthState>((set, get) => ({
  role: "guest",

  loginAsAuthorized: () => set({ role: "authorized" }),

  loginAsAdmin: () => set({ role: "admin" }),

  logout: () => set({ role: "guest" }),

  isAuthenticated: () => {
    const { role } = get();
    return role === "authorized" || role === "admin";
  },

  isAdmin: () => get().role === "admin",
}));
