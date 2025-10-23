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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  initiative TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner TEXT,
  initiative_manager TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency TEXT NOT NULL,
  progression_type TEXT DEFAULT 'linear',
  final_target REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, initiative, name)
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
