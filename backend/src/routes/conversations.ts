import { Router } from 'express';
import {
  getConversations,
  postConversation,
  removeConversation,
  patchConversationTitle,
  getConversationMessages,
  postMessage,
} from '../controllers/conversationController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// All conversation routes require authentication
router.use(requireAuth);

/**
 * GET /api/conversations
 * List all conversations for the authenticated user.
 */
router.get('/', getConversations);

/**
 * POST /api/conversations
 * Create a new conversation.
 * Body: { title?: string }
 */
router.post('/', postConversation);

/**
 * DELETE /api/conversations/:id
 * Delete a conversation (and its messages, cascaded by DB).
 */
router.delete('/:id', removeConversation);

/**
 * PATCH /api/conversations/:id/title
 * Rename a conversation.
 * Body: { title: string }
 */
router.patch('/:id/title', patchConversationTitle);

/**
 * GET /api/conversations/:id/messages
 * Fetch all messages for a conversation.
 */
router.get('/:id/messages', getConversationMessages);

/**
 * POST /api/conversations/:id/messages
 * Append a message to a conversation.
 * Body: { role: string, text: string, mapContext?: unknown }
 */
router.post('/:id/messages', postMessage);

export default router;
