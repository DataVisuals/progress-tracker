-- Migration: Add space admin assignments table
-- This allows admins to be scoped to specific spaces
-- System admins (is_system_admin = 1) have full access to all spaces
-- Regular admins need to be assigned to spaces via this table

-- Create space_admin_assignments table
CREATE TABLE IF NOT EXISTS space_admin_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  space_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, space_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_space_admin_user ON space_admin_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_space_admin_space ON space_admin_assignments(space_id);
