export type UserRole = "guest" | "authorized" | "admin";

export interface AuthState {
  role: UserRole;
  loginAsAuthorized: () => void;
  loginAsAdmin: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}
