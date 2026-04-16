-- Migration: 0004_sefaria_chunks
-- RAG source-of-truth table for ingested Sefaria passages.
-- Each row = one logical chunk (verse + Rashi, Mishna, Talmud section, etc.)
-- The vector is stored in Vectorize (binding VECTORIZE_SEFARIA).
-- vectorize_id matches the D1 id — we use id both as PK and as Vectorize vector id.

CREATE TABLE IF NOT EXISTS sefaria_chunks (
  id TEXT PRIMARY KEY,             -- UUID, also used as vectorize_id
  ref TEXT NOT NULL,               -- Sefaria canonical ref (e.g. "Berakhot.2a:1", "Genesis.1:1")
  book TEXT NOT NULL,              -- Book name (e.g. "Berakhot", "Genesis")
  category TEXT NOT NULL,          -- Top-level category (e.g. "Tanakh", "Talmud", "Mishnah")
  chapter TEXT,                    -- Chapter/daf (e.g. "1", "2a")
  position INTEGER NOT NULL,       -- Position within chapter for ordering
  he TEXT NOT NULL,                -- Hebrew/Aramaic source text (primary for embedding)
  en TEXT,                         -- English translation (if available)
  fr TEXT,                         -- French translation (if available)
  commentary_on TEXT,              -- If this is a commentary chunk, ref it comments on
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sefaria_chunks_ref ON sefaria_chunks(ref);
CREATE INDEX IF NOT EXISTS idx_sefaria_chunks_book ON sefaria_chunks(book);
CREATE INDEX IF NOT EXISTS idx_sefaria_chunks_category ON sefaria_chunks(category);
CREATE INDEX IF NOT EXISTS idx_sefaria_chunks_commentary_on ON sefaria_chunks(commentary_on);

-- Ingestion tracking: which refs have been successfully ingested
CREATE TABLE IF NOT EXISTS sefaria_ingestion_log (
  ref TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  chunks_count INTEGER NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  error TEXT
);
