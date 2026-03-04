import { FeedbackRepository }            from '../repositories/feedbackRepository';
import { AppError }                       from '../middleware/errorHandler';
import { FEEDBACK_STATUSES }              from '../models/feedback';
import type { Feedback, FeedbackStatus }  from '../models/feedback';

// ─── submitFeedback ───────────────────────────────────────────────────────────

/**
 * Validates and persists a new feedback message.
 *
 * @throws AppError(400) if message is empty or exceeds 5 000 characters
 */
export async function submitFeedback(message: string): Promise<Feedback> {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new AppError('message must not be empty', 400);
  }
  if (trimmed.length > 5_000) {
    throw new AppError('message must not exceed 5 000 characters', 400);
  }

  return FeedbackRepository.create({ message: trimmed });
}

// ─── listFeedback ─────────────────────────────────────────────────────────────

/**
 * Returns all feedback records, newest first.
 * Optionally filters by status.
 *
 * @throws AppError(400) if an unrecognised status filter is supplied
 */
export async function listFeedback(
  statusFilter?: string,
): Promise<Feedback[]> {
  if (statusFilter !== undefined && !FEEDBACK_STATUSES.includes(statusFilter as FeedbackStatus)) {
    throw new AppError(
      `Invalid status filter. Allowed values: ${FEEDBACK_STATUSES.join(', ')}`,
      400,
    );
  }

  return FeedbackRepository.findAll(statusFilter);
}

// ─── setFeedbackStatus ────────────────────────────────────────────────────────

/**
 * Updates the status of a feedback item.
 *
 * @throws AppError(400) if status is not a recognised value
 * @throws AppError(404) if the feedback record does not exist
 */
export async function setFeedbackStatus(
  id:     string,
  status: string,
): Promise<Feedback> {
  if (!FEEDBACK_STATUSES.includes(status as FeedbackStatus)) {
    throw new AppError(
      `Invalid status. Allowed values: ${FEEDBACK_STATUSES.join(', ')}`,
      400,
    );
  }

  const updated = await FeedbackRepository.updateStatus({
    id,
    status: status as FeedbackStatus,
  });

  if (!updated) {
    throw new AppError(`Feedback ${id} not found`, 404);
  }

  return updated;
}
