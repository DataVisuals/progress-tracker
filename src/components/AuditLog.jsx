import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { compactSelectStyles } from './SelectStyles';
import './AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]); // For timeline
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    user_id: '',
    project_id: '',
    limit: 100
  });

  useEffect(() => {
    loadUsers();
    loadProjects();
    loadLogs();
    loadAllLogsForTimeline();
  }, [filters]);

  const loadAllLogsForTimeline = async () => {
    try {
      // Load last 30 days of logs for the timeline
      const response = await api.getAuditLog({ limit: 1000 });
      setAllLogs(response.data);
    } catch (err) {
      console.error('Failed to load logs for timeline:', err);
    }
  };

  // Generate timeline data for last 30 days
  const timelineData = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = allLogs.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      days.push({
        date: date,
        dateStr: dateStr,
        total: dayLogs.length,
        creates: dayLogs.filter(l => l.action === 'CREATE').length,
        updates: dayLogs.filter(l => l.action === 'UPDATE').length,
        deletes: dayLogs.filter(l => l.action === 'DELETE').length
      });
    }

    return days;
  }, [allLogs]);

  const maxActivity = useMemo(() => {
    return Math.max(...timelineData.map(d => d.total), 1);
  }, [timelineData]);

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.action) params.action = filters.action;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.project_id) params.project_id = filters.project_id;
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

  // Filter logs by selected date
  const filteredLogs = useMemo(() => {
    if (!selectedDate) return logs;
    return logs.filter(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      return logDate === selectedDate;
    });
  }, [logs, selectedDate]);

  const handleDayClick = (dateStr) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null); // Toggle off
    } else {
      setSelectedDate(dateStr);
    }
  };

  const formatShortDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    // { value: 'craids', label: 'CRAIDs' } // DISABLED: CRAIDs feature hidden
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

  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...projects.map(project => ({ value: project.id.toString(), label: project.name }))
  ];

  const limitOptions = [
    { value: '50', label: '50 entries' },
    { value: '100', label: '100 entries' },
    { value: '250', label: '250 entries' },
    { value: '500', label: '500 entries' }
  ];

  return (
    <div className="audit-log-container">
      {/* Timeline Slider */}
      <div className="audit-timeline-slider">
        <div className="timeline-track">
          {timelineData.map((day, idx) => {
            const barHeight = day.total === 0 ? 4 : Math.max(8, (day.total / maxActivity) * 40);
            const isSelected = selectedDate === day.dateStr;
            return (
              <div
                key={day.dateStr}
                className={`timeline-bar-wrapper ${isSelected ? 'selected' : ''}`}
                onClick={() => handleDayClick(day.dateStr)}
              >
                <div
                  className="timeline-bar"
                  style={{ height: `${barHeight}px` }}
                  title={`${formatShortDate(day.date)}: ${day.total} changes`}
                />
                {isSelected && <div className="selection-indicator" />}
              </div>
            );
          })}
        </div>
        <div className="timeline-labels">
          <span>{formatShortDate(timelineData[0]?.date)}</span>
          <span className="timeline-selected-label">
            {selectedDate ? formatShortDate(new Date(selectedDate)) : 'All time'}
          </span>
          <span>Today</span>
        </div>
        {selectedDate && (
          <button className="clear-date-btn" onClick={() => setSelectedDate(null)}>
            Show all entries
          </button>
        )}
      </div>

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
            value={projectOptions.find(opt => opt.value === filters.project_id)}
            onChange={(option) => setFilters({ ...filters, project_id: option.value })}
            options={projectOptions}
            styles={compactSelectStyles}
            placeholder="Filter by project..."
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
      ) : filteredLogs.length === 0 ? (
        <div className="audit-empty">{selectedDate ? `No entries for ${formatShortDate(new Date(selectedDate))}` : 'No audit log entries found'}</div>
      ) : (
        <div className="audit-log-list">
          {filteredLogs.map((log) => (
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
