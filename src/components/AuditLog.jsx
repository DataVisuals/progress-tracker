import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { compactSelectStyles } from './SelectStyles';
import './AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    user_id: '',
    limit: 100
  });

  useEffect(() => {
    loadUsers();
    loadLogs();
  }, [filters]);

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.action) params.action = filters.action;
      if (filters.user_id) params.user_id = filters.user_id;
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

  const tableOptions = [
    { value: '', label: 'All Tables' },
    { value: 'projects', label: 'Projects' },
    { value: 'metrics', label: 'Metrics' },
    { value: 'metric_periods', label: 'Metric Periods' },
    { value: 'comments', label: 'Comments' },
    { value: 'craids', label: 'CRAIDs' }
  ];

  const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' }
  ];

  const userOptions = [
    { value: '', label: 'All Users' },
    ...users.map(user => ({ value: user.id.toString(), label: user.name }))
  ];

  const limitOptions = [
    { value: '50', label: '50 entries' },
    { value: '100', label: '100 entries' },
    { value: '250', label: '250 entries' },
    { value: '500', label: '500 entries' }
  ];

  return (
    <div className="audit-log-container">
      <div className="audit-log-header">
        <div className="audit-filters">
          <Select
            value={tableOptions.find(opt => opt.value === filters.table_name)}
            onChange={(option) => setFilters({ ...filters, table_name: option.value })}
            options={tableOptions}
            styles={compactSelectStyles}
            placeholder="Filter by table..."
            isClearable={false}
          />

          <Select
            value={actionOptions.find(opt => opt.value === filters.action)}
            onChange={(option) => setFilters({ ...filters, action: option.value })}
            options={actionOptions}
            styles={compactSelectStyles}
            placeholder="Filter by action..."
            isClearable={false}
          />

          <Select
            value={userOptions.find(opt => opt.value === filters.user_id)}
            onChange={(option) => setFilters({ ...filters, user_id: option.value })}
            options={userOptions}
            styles={compactSelectStyles}
            placeholder="Filter by user..."
            isClearable={false}
          />

          <Select
            value={limitOptions.find(opt => opt.value === filters.limit.toString())}
            onChange={(option) => setFilters({ ...filters, limit: option.value })}
            options={limitOptions}
            styles={compactSelectStyles}
            placeholder="Limit..."
            isClearable={false}
          />
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
