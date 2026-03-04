import { Router } from 'express';
import {
  createFeedback,
  getFeedback,
  updateFeedbackStatus,
} from '../controllers/feedbackController';
import { requireAuth }  from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';

const router = Router();

/**
 * POST /api/feedback
 *
 * Public — any visitor may submit feedback.
 * Body: { "message": string }
 */
router.post('/', createFeedback);

/**
 * GET /api/feedback
 *
 * Admin-only.  Returns all feedback records, newest first.
 * Optional query param: ?status=pending|reviewed|resolved
 */
router.get('/', requireAuth, requireAdmin, getFeedback);

/**
 * PUT /api/feedback/:id/status
 *
 * Admin-only.  Updates the status of a feedback record.
 * Body: { "status": "pending" | "reviewed" | "resolved" }
 */
router.put('/:id/status', requireAuth, requireAdmin, updateFeedbackStatus);

export default router;
