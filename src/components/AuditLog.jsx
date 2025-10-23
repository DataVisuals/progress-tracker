import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    limit: 50
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.action) params.action = filters.action;
      if (filters.limit) params.limit = filters.limit;

      const response = await api.getAuditLog(params);
      setLogs(response.data);
    } catch (err) {
      console.error('Failed to load audit log:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatJSON = (jsonString) => {
    if (!jsonString) return null;
    try {
      const obj = JSON.parse(jsonString);
      return JSON.stringify(obj, null, 2);
    } catch {
      return jsonString;
    }
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'CREATE': return 'action-create';
      case 'UPDATE': return 'action-update';
      case 'DELETE': return 'action-delete';
      default: return '';
    }
  };

  return (
    <div className="audit-log-container">
      <div className="audit-log-header">
        <div className="audit-filters">
          <select
            value={filters.table_name}
            onChange={(e) => setFilters({ ...filters, table_name: e.target.value })}
            className="filter-select"
          >
            <option value="">All Tables</option>
            <option value="projects">Projects</option>
            <option value="metrics">Metrics</option>
            <option value="metric_periods">Metric Periods</option>
            <option value="comments">Comments</option>
            <option value="craids">CRAIDs</option>
          </select>

          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="filter-select"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          <select
            value={filters.limit}
            onChange={(e) => setFilters({ ...filters, limit: e.target.value })}
            className="filter-select"
          >
            <option value="25">25 entries</option>
            <option value="50">50 entries</option>
            <option value="100">100 entries</option>
            <option value="250">250 entries</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="audit-loading">Loading audit log...</div>
      ) : logs.length === 0 ? (
        <div className="audit-empty">No audit log entries found</div>
      ) : (
        <div className="audit-log-list">
          {logs.map((log) => (
            <div key={log.id} className="audit-log-entry">
              <div className="audit-log-main">
                <div className="audit-log-top">
                  <span className={`audit-action-badge ${getActionBadgeClass(log.action)}`}>
                    {log.action}
                  </span>
                  <span className="audit-table-name">{log.table_name}</span>
                  <span className="audit-timestamp">{formatDate(log.created_at)}</span>
                </div>
                <div className="audit-description">{log.description}</div>
                <div className="audit-user">
                  {log.user_email || 'System'}
                  {log.ip_address && <span className="audit-ip"> ({log.ip_address})</span>}
                </div>
              </div>

              {(log.old_values || log.new_values) && (
                <details className="audit-details">
                  <summary>View Details</summary>
                  <div className="audit-values">
                    {log.old_values && (
                      <div className="audit-old-values">
                        <strong>Old Values:</strong>
                        <pre>{formatJSON(log.old_values)}</pre>
                      </div>
                    )}
                    {log.new_values && (
                      <div className="audit-new-values">
                        <strong>New Values:</strong>
                        <pre>{formatJSON(log.new_values)}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLog;
