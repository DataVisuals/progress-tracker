-- Performance Indexes Migration
-- This script adds additional indexes to improve query performance

-- Users table - frequently queried by email and name
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- Metric Periods - very frequently ordered by reporting_date
CREATE INDEX IF NOT EXISTS idx_metric_periods_reporting_date ON metric_periods(reporting_date);
CREATE INDEX IF NOT EXISTS idx_metric_periods_metric_date ON metric_periods(metric_id, reporting_date);

-- Comments - ordered by timestamps for recent commentary
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_updated_at ON comments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON comments(created_by);

-- CRAIDs - filtered by type and status
CREATE INDEX IF NOT EXISTS idx_craids_type ON craids(type);
CREATE INDEX IF NOT EXISTS idx_craids_status ON craids(status);
CREATE INDEX IF NOT EXISTS idx_craids_project_type ON craids(project_id, type);
CREATE INDEX IF NOT EXISTS idx_craids_project_status ON craids(project_id, status);
CREATE INDEX IF NOT EXISTS idx_craids_created_by ON craids(created_by);
CREATE INDEX IF NOT EXISTS idx_craids_owner ON craids(owner_id);

-- Milestones - ordered by target_date
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_project_date ON milestones(project_id, target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON milestones(completed);

-- Spaces - ordered by display_order and name
CREATE INDEX IF NOT EXISTS idx_spaces_display_order ON spaces(display_order);
CREATE INDEX IF NOT EXISTS idx_spaces_name ON spaces(name);

-- Portfolios - ordered by display_order and name
CREATE INDEX IF NOT EXISTS idx_portfolios_display_order ON portfolios(display_order);
CREATE INDEX IF NOT EXISTS idx_portfolios_name ON portfolios(name);
CREATE INDEX IF NOT EXISTS idx_portfolios_space ON portfolios(space_id);

-- Projects - add indexes for commonly used fields
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);

-- Metrics - add indexes for owner and dates
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner_id);
CREATE INDEX IF NOT EXISTS idx_metrics_start_date ON metrics(start_date);
CREATE INDEX IF NOT EXISTS idx_metrics_end_date ON metrics(end_date);

-- Composite index for audit log queries (table + date)
CREATE INDEX IF NOT EXISTS idx_audit_log_table_date ON audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id);
