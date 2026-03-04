-- ============================================================
-- Migration: 003_create_feedback
-- Description: Creates the feedback table for user-submitted
--              messages.  Status transitions are managed by
--              the admin PUT /api/feedback/:id/status endpoint.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    message    TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast admin listing (most-recent first)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
    ON feedback (created_at DESC);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_feedback_status
    ON feedback (status);
