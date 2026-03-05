export type UserRole = "guest" | "authorized" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  role: "authorized" | "admin";
  createdAt: string;
}

export interface AuthState {
  role: UserRole;
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Demo shortcut — sets role locally without a backend call. */
  loginAsAuthorized: () => void;
  /** Demo shortcut — sets role locally without a backend call. */
  loginAsAdmin: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}
