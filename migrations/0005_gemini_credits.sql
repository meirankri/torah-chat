-- Migration: 0005_gemini_credits
-- Adds gemini_credits column for Premium model credit tracking.
-- Free users get 5 credits at signup. Standard/Premium plans have unlimited access.

ALTER TABLE users ADD COLUMN gemini_credits INTEGER NOT NULL DEFAULT 5;
