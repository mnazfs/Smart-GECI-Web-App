import type { Request, Response, NextFunction } from 'express';
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  getMessages,
  addMessage,
} from '../services/conversationService';
import { AppError }        from '../middleware/errorHandler';
import { successResponse } from '../utils';

// ─── listConversations ────────────────────────────────────────────────────────

/**
 * GET /api/conversations
 * Returns all conversations for the authenticated user, newest first.
 */
export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const conversations = await listConversations(userId);
    res.json(successResponse(conversations));
  } catch (err) {
    next(err);
  }
}

// ─── createConversation ───────────────────────────────────────────────────────

/**
 * POST /api/conversations
 * Body: { title?: string }
 */
export async function postConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { title } = req.body as { title?: unknown };
    const safeTitle = typeof title === 'string' ? title : undefined;
    const conversation = await createConversation(userId, safeTitle);
    res.status(201).json(successResponse(conversation));
  } catch (err) {
    next(err);
  }
}

// ─── deleteConversation ───────────────────────────────────────────────────────

/**
 * DELETE /api/conversations/:id
 */
export async function removeConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id }  = req.params;
    await deleteConversation(id, userId);
    res.json(successResponse({ id }));
  } catch (err) {
    next(err);
  }
}

// ─── renameConversation ───────────────────────────────────────────────────────

/**
 * PATCH /api/conversations/:id/title
 * Body: { title: string }
 */
export async function patchConversationTitle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId        = req.user!.id;
    const { id }        = req.params;
    const { title }     = req.body as { title?: unknown };

    if (typeof title !== 'string') {
      return next(new AppError('title is required and must be a string', 400));
    }

    const updated = await renameConversation(id, userId, title);
    res.json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}

// ─── getMessages ──────────────────────────────────────────────────────────────

/**
 * GET /api/conversations/:id/messages
 */
export async function getConversationMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const messages = await getMessages(id, userId);
    res.json(successResponse(messages));
  } catch (err) {
    next(err);
  }
}

// ─── addMessage ───────────────────────────────────────────────────────────────

/**
 * POST /api/conversations/:id/messages
 * Body: { role: MessageRole, text: string, mapContext?: unknown }
 */
export async function postMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId        = req.user!.id;
    const { id }        = req.params;
    const { role, text, mapContext } = req.body as {
      role?:       unknown;
      text?:       unknown;
      mapContext?: unknown;
    };

    if (typeof role !== 'string') {
      return next(new AppError('role is required and must be a string', 400));
    }
    if (typeof text !== 'string') {
      return next(new AppError('text is required and must be a string', 400));
    }

    const message = await addMessage(id, userId, role, text, mapContext);
    res.status(201).json(successResponse(message));
  } catch (err) {
    next(err);
  }
}
