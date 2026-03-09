import type { PoolClient } from 'pg';
import db from '../config/db';
import type {
  Conversation,
  ConversationRow,
  ChatMessage,
  MessageRow,
  CreateConversationInput,
  CreateMessageInput,
  UpdateConversationTitleInput,
} from '../models/conversation';
import { rowToConversation, rowToMessage } from '../models/conversation';

// ─── ConversationRepository ───────────────────────────────────────────────────

export const ConversationRepository = {

  // ── findAllByUser ───────────────────────────────────────────────────────────

  async findAllByUser(
    userId: string,
    client?: PoolClient,
  ): Promise<Conversation[]> {
    const conn = client ?? db;
    const result = await conn.query<ConversationRow>(
      `SELECT id, user_id, title, created_at, updated_at
       FROM   nlp_conversations
       WHERE  user_id = $1
       ORDER  BY updated_at DESC`,
      [userId],
    );
    return result.rows.map(rowToConversation);
  },

  // ── create ─────────────────────────────────────────────────────────────────

  async create(
    input: CreateConversationInput,
    client?: PoolClient,
  ): Promise<Conversation> {
    const conn  = client ?? db;
    const title = input.title?.trim() || 'New conversation';
    const result = await conn.query<ConversationRow>(
      `INSERT INTO nlp_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at, updated_at`,
      [input.userId, title],
    );
    return rowToConversation(result.rows[0] as ConversationRow);
  },

  // ── findById ───────────────────────────────────────────────────────────────

  /**
   * Returns the conversation only if it belongs to the given user.
   */
  async findById(
    id:     string,
    userId: string,
    client?: PoolClient,
  ): Promise<Conversation | null> {
    const conn = client ?? db;
    const result = await conn.query<ConversationRow>(
      `SELECT id, user_id, title, created_at, updated_at
       FROM   nlp_conversations
       WHERE  id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (result.rows.length === 0) return null;
    return rowToConversation(result.rows[0] as ConversationRow);
  },

  // ── updateTitle ────────────────────────────────────────────────────────────

  async updateTitle(
    input:  UpdateConversationTitleInput,
    client?: PoolClient,
  ): Promise<Conversation | null> {
    const conn = client ?? db;
    const result = await conn.query<ConversationRow>(
      `UPDATE nlp_conversations
       SET    title = $1, updated_at = NOW()
       WHERE  id = $2 AND user_id = $3
       RETURNING id, user_id, title, created_at, updated_at`,
      [input.title.trim(), input.id, input.userId],
    );
    if (result.rows.length === 0) return null;
    return rowToConversation(result.rows[0] as ConversationRow);
  },

  // ── touchUpdatedAt ─────────────────────────────────────────────────────────

  /**
   * Bumps updated_at so the conversation floats to the top of the user's list.
   */
  async touchUpdatedAt(
    id:     string,
    userId: string,
    client?: PoolClient,
  ): Promise<void> {
    const conn = client ?? db;
    await conn.query(
      `UPDATE nlp_conversations SET updated_at = NOW()
       WHERE  id = $1 AND user_id = $2`,
      [id, userId],
    );
  },

  // ── delete ─────────────────────────────────────────────────────────────────

  async delete(
    id:     string,
    userId: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const conn = client ?? db;
    const result = await conn.query(
      `DELETE FROM nlp_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  // ── getMessages ────────────────────────────────────────────────────────────

  async getMessages(
    conversationId: string,
    userId:         string,
    client?:        PoolClient,
  ): Promise<ChatMessage[]> {
    const conn = client ?? db;
    // Verify ownership first
    const owns = await this.findById(conversationId, userId, client);
    if (!owns) return [];

    const result = await conn.query<MessageRow>(
      `SELECT id, conversation_id, role, text, map_context, created_at
       FROM   nlp_messages
       WHERE  conversation_id = $1
       ORDER  BY created_at ASC`,
      [conversationId],
    );
    return result.rows.map(rowToMessage);
  },

  // ── addMessage ─────────────────────────────────────────────────────────────

  async addMessage(
    input:   CreateMessageInput,
    client?: PoolClient,
  ): Promise<ChatMessage> {
    const conn = client ?? db;
    const result = await conn.query<MessageRow>(
      `INSERT INTO nlp_messages (conversation_id, role, text, map_context)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, role, text, map_context, created_at`,
      [
        input.conversationId,
        input.role,
        input.text,
        input.mapContext !== undefined ? JSON.stringify(input.mapContext) : null,
      ],
    );
    return rowToMessage(result.rows[0] as MessageRow);
  },
};
