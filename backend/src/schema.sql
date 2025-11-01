-- Progress Tracker Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
  amber_tolerance REAL DEFAULT 5.0,
  red_tolerance REAL DEFAULT 10.0,
  metric_type TEXT DEFAULT 'lead' CHECK(metric_type IN ('lead', 'lag')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS metric_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL,
  reporting_date DATE NOT NULL,
  expected REAL NOT NULL,
  complete REAL DEFAULT 0,
  commentary TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
  UNIQUE(metric_id, reporting_date)
);

CREATE INDEX IF NOT EXISTS idx_metric_periods_metric ON metric_periods(metric_id);
CREATE INDEX IF NOT EXISTS idx_metrics_project ON metrics(project_id);

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
