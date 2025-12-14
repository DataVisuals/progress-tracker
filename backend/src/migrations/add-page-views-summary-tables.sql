-- Page Views Summary Tables for Performance Optimization
-- These tables store aggregated page view data after the retention period
-- to reduce database size while maintaining historical analytics

CREATE TABLE IF NOT EXISTS page_views_daily_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_date DATE NOT NULL UNIQUE,
  total_views INTEGER DEFAULT 0,
  avg_load_time REAL,
  min_load_time INTEGER,
  max_load_time INTEGER,
  views_with_timing INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_views_daily_summary_date ON page_views_daily_summary(summary_date);

CREATE TABLE IF NOT EXISTS page_views_path_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_date DATE NOT NULL,
  path TEXT NOT NULL,
  total_views INTEGER DEFAULT 0,
  avg_load_time REAL,
  min_load_time INTEGER,
  max_load_time INTEGER,
  views_with_timing INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(summary_date, path)
);

CREATE INDEX IF NOT EXISTS idx_page_views_path_summary_date ON page_views_path_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_page_views_path_summary_path ON page_views_path_summary(path);
