-- Migration: Add spaces feature
-- Date: 2025-11-24
-- Description: Add spaces table to group portfolios, add space_id to portfolios, and default_space_id to users

-- Create spaces table
CREATE TABLE IF NOT EXISTS spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add space_id column to portfolios table
ALTER TABLE portfolios ADD COLUMN space_id INTEGER REFERENCES spaces(id) ON DELETE SET NULL;

-- Add default_space_id column to users table
ALTER TABLE users ADD COLUMN default_space_id INTEGER REFERENCES spaces(id) ON DELETE SET NULL;

-- Create index for space_id in portfolios
CREATE INDEX IF NOT EXISTS idx_portfolios_space ON portfolios(space_id);

-- Insert a default "All Spaces" entry (optional, can be used for filtering)
INSERT INTO spaces (id, name, description, color, display_order)
VALUES (1, 'Default Space', 'Default space for all portfolios', '#6366f1', 0)
ON CONFLICT(id) DO NOTHING;
