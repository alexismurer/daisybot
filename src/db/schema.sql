-- Long-term user facts (one row per user, upserted in-place)
CREATE TABLE user_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL UNIQUE,
  facts           JSONB NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user per-channel conversation log (append-only)
CREATE TABLE conversation_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  channel_id      TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('human', 'ai')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conv_history_user_channel
  ON conversation_history (discord_user_id, channel_id, created_at DESC);

-- Per-user persona configuration (one row per user)
CREATE TABLE user_persona (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id     TEXT        UNIQUE NOT NULL,
  bot_gender          TEXT        NOT NULL DEFAULT 'neutral',
  speaking_style      TEXT        NOT NULL DEFAULT 'friendly',
  relationship        TEXT        NOT NULL DEFAULT 'assistant',
  custom_instructions TEXT,
  bot_appearance      TEXT,
  bot_age             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Migration (run if table already exists):
-- ALTER TABLE user_persona ADD COLUMN IF NOT EXISTS bot_appearance TEXT;
-- ALTER TABLE user_persona ADD COLUMN IF NOT EXISTS bot_age TEXT;
