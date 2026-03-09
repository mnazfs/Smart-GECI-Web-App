// ─── Message role ────────────────────────────────────────────────────────────

export type MessageRole =
  | 'user'
  | 'assistant'
  | 'warning'
  | 'error'
  | 'spatial_info';

export const MESSAGE_ROLES: MessageRole[] = [
  'user',
  'assistant',
  'warning',
  'error',
  'spatial_info',
];

// ─── Database rows (snake_case) ───────────────────────────────────────────────

export interface ConversationRow {
  id:         string;
  user_id:    string;
  title:      string;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id:              string;
  conversation_id: string;
  role:            MessageRole;
  text:            string;
  map_context:     unknown | null;
  created_at:      Date;
}

// ─── Application models (camelCase) ──────────────────────────────────────────

export interface Conversation {
  id:        string;
  userId:    string;
  title:     string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id:             string;
  conversationId: string;
  role:           MessageRole;
  text:           string;
  mapContext?:    unknown;
  createdAt:      Date;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role:           MessageRole;
  text:           string;
  mapContext?:    unknown;
}

export interface UpdateConversationTitleInput {
  id:     string;
  userId: string;
  title:  string;
}

// ─── Row → Model mappers ──────────────────────────────────────────────────────

export function rowToConversation(row: ConversationRow): Conversation {
  return {
    id:        row.id,
    userId:    row.user_id,
    title:     row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id:             row.id,
    conversationId: row.conversation_id,
    role:           row.role,
    text:           row.text,
    mapContext:     row.map_context ?? undefined,
    createdAt:      row.created_at,
  };
}
