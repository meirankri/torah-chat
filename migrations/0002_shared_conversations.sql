-- Migration: 0002_shared_conversations
-- Add shared_conversations table for public read-only share links

CREATE TABLE IF NOT EXISTS shared_conversations (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_conversations_token ON shared_conversations(token);
CREATE INDEX IF NOT EXISTS idx_shared_conversations_conv ON shared_conversations(conversation_id);
