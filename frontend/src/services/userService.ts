import { apiClient } from "./api";

export interface AdminUser {
  id: string;
  username: string;
  role: "authorized" | "admin";
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<ApiResponse<{ users: AdminUser[] }>>("/users");
  return res.data.data.users;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: "authorized" | "admin";
}): Promise<AdminUser> {
  const res = await apiClient.post<ApiResponse<{ user: AdminUser }>>(
    "/auth/register",
    payload
  );
  return res.data.data.user;
}

export async function updateUser(
  id: string,
  payload: { username?: string; password?: string }
): Promise<AdminUser> {
  const res = await apiClient.put<ApiResponse<{ user: AdminUser }>>(
    `/users/${id}`,
    payload
  );
  return res.data.data.user;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
