import { apiClient } from "@/services/api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id:        string;
  userId:    string;
  title:     string;
  createdAt: string;
  updatedAt: string;
}

export type StoredMessageRole =
  | "user"
  | "assistant"
  | "warning"
  | "error"
  | "spatial_info";

export interface StoredMessage {
  id:             string;
  conversationId: string;
  role:           StoredMessageRole;
  text:           string;
  mapContext?:    unknown;
  createdAt:      string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getConversations(): Promise<ConversationSummary[]> {
  const { data } = await apiClient.get<{ success: true; data: ConversationSummary[] }>(
    "/conversations",
  );
  return data.data;
}

export async function createConversation(
  title?: string,
): Promise<ConversationSummary> {
  const { data } = await apiClient.post<{ success: true; data: ConversationSummary }>(
    "/conversations",
    { title },
  );
  return data.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/conversations/${id}`);
}

export async function renameConversation(
  id:    string,
  title: string,
): Promise<ConversationSummary> {
  const { data } = await apiClient.patch<{ success: true; data: ConversationSummary }>(
    `/conversations/${id}/title`,
    { title },
  );
  return data.data;
}

export async function getMessages(
  conversationId: string,
): Promise<StoredMessage[]> {
  const { data } = await apiClient.get<{ success: true; data: StoredMessage[] }>(
    `/conversations/${conversationId}/messages`,
  );
  return data.data;
}

export async function addMessage(
  conversationId: string,
  role:           StoredMessageRole,
  text:           string,
  mapContext?:    unknown,
): Promise<StoredMessage> {
  const { data } = await apiClient.post<{ success: true; data: StoredMessage }>(
    `/conversations/${conversationId}/messages`,
    { role, text, mapContext },
  );
  return data.data;
}
