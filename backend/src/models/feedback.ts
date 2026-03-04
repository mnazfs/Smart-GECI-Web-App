// ─── Database row (snake_case mirrors DB column names) ───────────────────────

export interface FeedbackRow {
  id:         string;
  message:    string;
  status:     FeedbackStatus;
  created_at: Date;
}

// ─── Application model (camelCase) ───────────────────────────────────────────

export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved';

export interface Feedback {
  id:        string;
  message:   string;
  status:    FeedbackStatus;
  createdAt: Date;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateFeedbackInput {
  message: string;
}

export interface UpdateFeedbackStatusInput {
  id:     string;
  status: FeedbackStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['pending', 'reviewed', 'resolved'];

// ─── Row → Model mapper ───────────────────────────────────────────────────────

export function rowToFeedback(row: FeedbackRow): Feedback {
  return {
    id:        row.id,
    message:   row.message,
    status:    row.status,
    createdAt: row.created_at,
  };
}
