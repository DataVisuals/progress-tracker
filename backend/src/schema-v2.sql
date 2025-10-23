-- Progress Tracker Database Schema V2 (Properly Normalized)

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  initiative_manager TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metrics (one-to-many with Projects)
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  owner_id INTEGER,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency TEXT NOT NULL,
  progression_type TEXT DEFAULT 'linear',
  final_target REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  UNIQUE(project_id, name)
);

-- Metric Periods (one-to-many with Metrics)
CREATE TABLE IF NOT EXISTS metric_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL,
  reporting_date DATE NOT NULL,
  expected REAL NOT NULL,
  target REAL NOT NULL,
  complete REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
  UNIQUE(metric_id, reporting_date)
);

-- Comments (one-to-many with Metric Periods)
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES metric_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CRAIDs: Comments, Risks, Actions, Issues, Dependencies (one-to-many with Projects)
CREATE TABLE IF NOT EXISTS craids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'comment', 'risk', 'action', 'issue', 'dependency'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'closed'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  owner_id INTEGER,
  period_id INTEGER, -- Optional: link to a specific reporting period
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (period_id) REFERENCES metric_periods(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_metric_periods_metric ON metric_periods(metric_id);
CREATE INDEX IF NOT EXISTS idx_metrics_project ON metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_period ON comments(period_id);
CREATE INDEX IF NOT EXISTS idx_craids_project ON craids(project_id);
CREATE INDEX IF NOT EXISTS idx_craids_period ON craids(period_id);

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
