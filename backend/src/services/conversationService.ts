import { ConversationRepository }  from '../repositories/conversationRepository';
import { AppError }                from '../middleware/errorHandler';
import type {
  Conversation,
  ChatMessage,
  MessageRole,
} from '../models/conversation';

const MAX_TITLE_LEN    = 200;
const MAX_MESSAGE_LEN  = 20_000;
const MAX_CONVERSATIONS = 200; // soft cap per user

// ─── listConversations ────────────────────────────────────────────────────────

export async function listConversations(
  userId: string,
): Promise<Conversation[]> {
  return ConversationRepository.findAllByUser(userId);
}

// ─── createConversation ───────────────────────────────────────────────────────

export async function createConversation(
  userId: string,
  title?: string,
): Promise<Conversation> {
  const count = (await ConversationRepository.findAllByUser(userId)).length;
  if (count >= MAX_CONVERSATIONS) {
    throw new AppError(
      `You have reached the maximum number of saved conversations (${MAX_CONVERSATIONS}). Please delete some before creating new ones.`,
      400,
    );
  }

  const safeTitle = title?.trim().slice(0, MAX_TITLE_LEN) || 'New conversation';
  return ConversationRepository.create({ userId, title: safeTitle });
}

// ─── deleteConversation ───────────────────────────────────────────────────────

export async function deleteConversation(
  id:     string,
  userId: string,
): Promise<void> {
  const deleted = await ConversationRepository.delete(id, userId);
  if (!deleted) {
    throw new AppError('Conversation not found', 404);
  }
}

// ─── renameConversation ───────────────────────────────────────────────────────

export async function renameConversation(
  id:     string,
  userId: string,
  title:  string,
): Promise<Conversation> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new AppError('title must not be empty', 400);
  }
  if (trimmed.length > MAX_TITLE_LEN) {
    throw new AppError(`title must not exceed ${MAX_TITLE_LEN} characters`, 400);
  }

  const updated = await ConversationRepository.updateTitle({ id, userId, title: trimmed });
  if (!updated) {
    throw new AppError('Conversation not found', 404);
  }
  return updated;
}

// ─── getMessages ──────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  userId:         string,
): Promise<ChatMessage[]> {
  // findById inside getMessages already checks ownership and returns []
  return ConversationRepository.getMessages(conversationId, userId);
}

// ─── addMessage ───────────────────────────────────────────────────────────────

export async function addMessage(
  conversationId: string,
  userId:         string,
  role:           string,
  text:           string,
  mapContext?:    unknown,
): Promise<ChatMessage> {
  const VALID_ROLES: MessageRole[] = [
    'user', 'assistant', 'warning', 'error', 'spatial_info',
  ];

  if (!VALID_ROLES.includes(role as MessageRole)) {
    throw new AppError(`Invalid role. Allowed: ${VALID_ROLES.join(', ')}`, 400);
  }
  if (!text || text.trim().length === 0) {
    throw new AppError('text must not be empty', 400);
  }
  if (text.length > MAX_MESSAGE_LEN) {
    throw new AppError(`text must not exceed ${MAX_MESSAGE_LEN} characters`, 400);
  }

  // Verify ownership
  const conv = await ConversationRepository.findById(conversationId, userId);
  if (!conv) {
    throw new AppError('Conversation not found', 404);
  }

  const message = await ConversationRepository.addMessage({
    conversationId,
    role:       role as MessageRole,
    text:       text.trim(),
    mapContext,
  });

  // Bump updated_at so conversation surfaces at the top
  await ConversationRepository.touchUpdatedAt(conversationId, userId);

  return message;
}
