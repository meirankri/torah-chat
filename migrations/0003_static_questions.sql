-- Migration: 0003_static_questions
-- Static SEO pages for frequently asked Torah questions

CREATE TABLE IF NOT EXISTS static_questions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  category TEXT,
  sources_json TEXT,   -- JSON array of { ref, url } for structured data
  meta_description TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_static_questions_slug ON static_questions(slug);
CREATE INDEX IF NOT EXISTS idx_static_questions_language ON static_questions(language);
CREATE INDEX IF NOT EXISTS idx_static_questions_published ON static_questions(published);
