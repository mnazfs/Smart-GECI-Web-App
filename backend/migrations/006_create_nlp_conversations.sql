-- ============================================================
-- Migration: 006_create_nlp_conversations
-- Description: Persistent NLP chat history.
--              Each authenticated user owns one or more
--              conversations; each conversation contains an
--              ordered list of messages.
-- ============================================================

-- ── Conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nlp_conversations (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast per-user listing (most-recently-updated first)
CREATE INDEX IF NOT EXISTS idx_nlp_conv_user_updated
    ON nlp_conversations (user_id, updated_at DESC);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nlp_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL
                        REFERENCES nlp_conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL
                        CHECK (role IN ('user','assistant','warning','error','spatial_info')),
    text            TEXT        NOT NULL,
    map_context     JSONB,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast per-conversation message listing (chronological order)
CREATE INDEX IF NOT EXISTS idx_nlp_msg_conv_created
    ON nlp_messages (conversation_id, created_at ASC);
