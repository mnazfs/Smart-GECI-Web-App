import type { Request, Response, NextFunction } from 'express';
import { submitFeedback, listFeedback, setFeedbackStatus } from '../services/feedbackService';
import { AppError }       from '../middleware/errorHandler';
import { successResponse } from '../utils';

// ─── createFeedback ───────────────────────────────────────────────────────────

/**
 * POST /api/feedback
 *
 * Public endpoint — no authentication required.
 *
 * Body: { "message": string }
 *
 * 201 — created feedback record
 * 400 — missing, empty, or too-long message
 */
export async function createFeedback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { message } = req.body as { message?: unknown };

    if (typeof message !== 'string') {
      return next(new AppError('message is required and must be a string', 400));
    }

    const feedback = await submitFeedback(message);
    res.status(201).json(successResponse(feedback));
  } catch (err) {
    next(err);
  }
}

// ─── getFeedback ──────────────────────────────────────────────────────────────

/**
 * GET /api/feedback
 *
 * Admin-only.  Returns all feedback, newest first.
 *
 * Query params (all optional):
 *   status — filter by status ('pending' | 'reviewed' | 'resolved')
 *
 * 200 — array of feedback records
 * 400 — unrecognised status filter value
 * 401/403 — enforced by middleware, not here
 */
export async function getFeedback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status } = req.query as { status?: string };
    const items = await listFeedback(status);
    res.status(200).json(successResponse(items));
  } catch (err) {
    next(err);
  }
}

// ─── updateFeedbackStatus ─────────────────────────────────────────────────────

/**
 * PUT /api/feedback/:id/status
 *
 * Admin-only.  Transitions a feedback record to a new status.
 *
 * Body: { "status": "pending" | "reviewed" | "resolved" }
 *
 * 200 — updated feedback record
 * 400 — invalid or missing status value
 * 401/403 — enforced by middleware, not here
 * 404 — feedback record not found
 */
export async function updateFeedbackStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }     = req.params as { id: string };
    const { status } = req.body   as { status?: unknown };

    if (typeof status !== 'string') {
      return next(new AppError('status is required and must be a string', 400));
    }

    const updated = await setFeedbackStatus(id, status);
    res.status(200).json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}
