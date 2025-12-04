import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { MdHistory, MdAdd, MdEdit, MdRemove } from 'react-icons/md';
import { api } from '../../api/client';
import { compactSelectStyles } from '../SelectStyles';

const AuditPanel = ({
  panelId,
  index,
  isAdmin,
  forDock,
  auditLog: auditLogProp,
  auditTimeline: auditTimelineProp,
  auditHoveredDateIdx,
  setAuditHoveredDateIdx,
  auditSelectedDateIdx,
  setAuditSelectedDateIdx
}) => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    user_id: '',
    project_id: '',
    limit: forDock ? 100 : 50
  });
  const [localAuditLog, setLocalAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);

  // Use local audit log if filters are active, otherwise use prop
  const hasActiveFilters = filters.table_name || filters.action || filters.user_id || filters.project_id;
  const auditLog = hasActiveFilters ? localAuditLog : auditLogProp;
  const auditTimeline = auditTimelineProp;

  useEffect(() => {
    if (forDock && isAdmin) {
      loadUsers();
      loadProjects();
    }
  }, [forDock, isAdmin]);

  useEffect(() => {
    if (forDock && hasActiveFilters) {
      loadFilteredLogs();
    }
  }, [filters, forDock]);

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadFilteredLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.action) params.action = filters.action;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.project_id) params.project_id = filters.project_id;
      if (filters.limit) params.limit = filters.limit;

      const response = await api.getAuditLog(params);
      setLocalAuditLog(response.data);
    } catch (err) {
      console.error('Failed to load filtered audit log:', err);
      setLocalAuditLog([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  // Generate activity summary
  const generateActivitySummary = (logs) => {
    if (!logs || logs.length === 0) return [];

    // Group by user and action type
    const userActivity = {};
    logs.forEach(entry => {
      const userName = entry.user_email?.split('@')[0] || 'System';
      if (!userActivity[userName]) {
        userActivity[userName] = { updates: {}, creates: {}, deletes: {} };
      }

      const tableName = entry.table_name?.replace(/_/g, ' ') || 'records';
      const projectContext = entry.project_name ? ` in ${entry.project_name}` : '';
      const key = `${tableName}${projectContext}`;

      if (entry.action === 'UPDATE') {
        userActivity[userName].updates[key] = (userActivity[userName].updates[key] || 0) + 1;
      } else if (entry.action === 'CREATE') {
        userActivity[userName].creates[key] = (userActivity[userName].creates[key] || 0) + 1;
      } else if (entry.action === 'DELETE') {
        userActivity[userName].deletes[key] = (userActivity[userName].deletes[key] || 0) + 1;
      }
    });

    // Build detailed summaries for each user's activities
    const summaries = [];
    Object.entries(userActivity).forEach(([user, activity]) => {
      const topUpdates = Object.entries(activity.updates).sort((a, b) => b[1] - a[1]);
      const topCreates = Object.entries(activity.creates).sort((a, b) => b[1] - a[1]);
      const topDeletes = Object.entries(activity.deletes).sort((a, b) => b[1] - a[1]);

      topUpdates.slice(0, 2).forEach(([target]) => {
        summaries.push({ user, text: `updating ${target}` });
      });
      topCreates.slice(0, 2).forEach(([target]) => {
        summaries.push({ user, text: `creating ${target}` });
      });
      topDeletes.slice(0, 1).forEach(([target]) => {
        summaries.push({ user, text: `removing ${target}` });
      });
    });

    return summaries.slice(0, forDock ? 10 : 5);
  };

  const activitySummary = generateActivitySummary(auditLog);

  const getActionVerb = (action) => {
    switch(action) {
      case 'CREATE': return 'created';
      case 'UPDATE': return 'updated';
      case 'DELETE': return 'deleted';
      default: return action.toLowerCase();
    }
  };
  const formatTableName = (tableName) => {
    return tableName?.replace(/_/g, ' ').replace(/s$/, '') || 'record';
  };
  const formatValues = (entry) => {
    try {
      const newVals = entry.new_values ? JSON.parse(entry.new_values) : null;
      const oldVals = entry.old_values ? JSON.parse(entry.old_values) : null;
      const changes = [];
      const formatVal = (v) => {
        if (v === null || v === undefined) return '(empty)';
        if (typeof v === 'number') return v.toLocaleString();
        if (typeof v === 'string' && v.trim() === '') return '(empty)';
        return v;
      };

      // Ensure we have actual objects, not strings or other primitives
      const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

      if (entry.action === 'UPDATE' && isObject(newVals) && isObject(oldVals)) {
        Object.keys(newVals).forEach(key => {
          const oldVal = formatVal(oldVals[key]);
          const newVal = formatVal(newVals[key]);
          const changed = oldVal !== newVal;
          changes.push({ field: key, from: oldVal, to: newVal, changed });
        });
        // Sort so changed fields appear first
        changes.sort((a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0));
      } else if (entry.action === 'UPDATE' && isObject(newVals)) {
        Object.keys(newVals).forEach(key => {
          changes.push({ field: key, to: formatVal(newVals[key]), changed: true });
        });
      } else if (entry.action === 'CREATE' && isObject(newVals)) {
        Object.keys(newVals).forEach(key => {
          changes.push({ field: key, value: formatVal(newVals[key]) });
        });
      } else if (entry.action === 'DELETE' && isObject(oldVals)) {
        Object.keys(oldVals).forEach(key => {
          changes.push({ field: key, value: formatVal(oldVals[key]) });
        });
      }
      return changes;
    } catch {
      return [];
    }
  };

  // Group entries by date for timeline
  const groupByDate = (entries) => {
    const groups = {};
    entries.forEach(entry => {
      const date = new Date(entry.created_at);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });
    return Object.entries(groups);
  };

  // Use timeline data from backend (more accurate counts)
  const dailyActivity = auditTimeline.map(day => ({
    date: new Date(day.date + 'T00:00:00'), // Parse as local date
    dateKey: new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    dateStr: day.date, // Keep original YYYY-MM-DD format for filtering
    total: day.total
  }));
  const maxDailyActivity = Math.max(...dailyActivity.map(d => d.total), 1);
  const totalChanges = dailyActivity.reduce((sum, d) => sum + d.total, 0);

  // For tooltip/summary: hover takes priority so user can scan dates while maintaining selection
  const displayIdx = auditHoveredDateIdx !== null ? auditHoveredDateIdx : auditSelectedDateIdx;
  const displayDate = displayIdx !== null && displayIdx < dailyActivity.length ? dailyActivity[displayIdx] : null;

  const getActionIcon = (action) => {
    switch(action) {
      case 'CREATE': return <MdAdd className="timeline-action-icon create" />;
      case 'UPDATE': return <MdEdit className="timeline-action-icon update" />;
      case 'DELETE': return <MdRemove className="timeline-action-icon delete" />;
      default: return <MdHistory className="timeline-action-icon" />;
    }
  };

  const timelineEntries = auditLog.slice(0, forDock ? 100 : 50);

  // When a date is selected, entries are already filtered by backend
  // Only do client-side filtering for hover (non-selected) state
  const filteredEntries = (auditSelectedDateIdx === null && displayDate)
    ? timelineEntries.filter(entry => {
        const entryDateStr = new Date(entry.created_at).toISOString().split('T')[0];
        return entryDateStr === displayDate.dateKey;
      })
    : timelineEntries;
  const groupedEntries = groupByDate(filteredEntries);

  const tableOptions = [
    { value: '', label: 'All Tables' },
    { value: 'projects', label: 'Projects' },
    { value: 'metrics', label: 'Metrics' },
    { value: 'metric_periods', label: 'Metric Periods' },
    { value: 'comments', label: 'Comments' }
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

  return (
    <div key={panelId} className={`home-quadrant audit-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdHistory className="quadrant-icon" />
        <h2>Audit Log</h2>
      </div>
      <div className="quadrant-content">
        {forDock && (
          <div className="audit-filters-row">
            <Select
              value={tableOptions.find(opt => opt.value === filters.table_name)}
              onChange={(option) => setFilters({ ...filters, table_name: option.value })}
              options={tableOptions}
              styles={compactSelectStyles}
              placeholder="Table..."
              isClearable={false}
            />
            <Select
              value={actionOptions.find(opt => opt.value === filters.action)}
              onChange={(option) => setFilters({ ...filters, action: option.value })}
              options={actionOptions}
              styles={compactSelectStyles}
              placeholder="Action..."
              isClearable={false}
            />
            <Select
              value={userOptions.find(opt => opt.value === filters.user_id)}
              onChange={(option) => setFilters({ ...filters, user_id: option.value })}
              options={userOptions}
              styles={compactSelectStyles}
              placeholder="User..."
              isClearable={false}
            />
            <Select
              value={projectOptions.find(opt => opt.value === filters.project_id)}
              onChange={(option) => setFilters({ ...filters, project_id: option.value })}
              options={projectOptions}
              styles={compactSelectStyles}
              placeholder="Project..."
              isClearable={false}
            />
          </div>
        )}
        {auditTimeline.length === 0 && auditLog.length === 0 ? (
          <div className="empty-state">
            <MdHistory className="empty-icon" />
            <p>No recent activity</p>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p>Loading filtered logs...</p>
          </div>
        ) : (
          <div className="audit-timeline-container">
            {/* Horizontal Activity Overview - Line Chart */}
            <div className="audit-activity-overview" onMouseLeave={() => setAuditHoveredDateIdx(null)}>
              <svg className="activity-line-chart" viewBox="0 0 200 24" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={`M0,24 ${dailyActivity.map((day, idx) => {
                    const x = (idx / (dailyActivity.length - 1)) * 200;
                    const y = 24 - (day.total === 0 ? 1 : Math.max(2, (day.total / maxDailyActivity) * 22));
                    return `L${x},${y}`;
                  }).join(' ')} L200,24 Z`}
                  fill="url(#activityGradient)"
                />
                {/* Line */}
                <path
                  d={`M${dailyActivity.map((day, idx) => {
                    const x = (idx / (dailyActivity.length - 1)) * 200;
                    const y = 24 - (day.total === 0 ? 1 : Math.max(2, (day.total / maxDailyActivity) * 22));
                    return `${idx === 0 ? '' : 'L'}${x},${y}`;
                  }).join(' ')}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Hover zones */}
                {dailyActivity.map((day, idx) => {
                  const segmentWidth = 200 / dailyActivity.length;
                  const x = idx * segmentWidth;
                  return (
                    <rect
                      key={idx}
                      x={x}
                      y={0}
                      width={segmentWidth}
                      height={24}
                      fill="transparent"
                      className="activity-hover-zone"
                      onMouseEnter={() => setAuditHoveredDateIdx(idx)}
                      onClick={() => setAuditSelectedDateIdx(auditSelectedDateIdx === idx ? null : idx)}
                    />
                  );
                })}
                {/* Selected date indicator line (solid) */}
                {auditSelectedDateIdx !== null && (
                  <line
                    x1={(auditSelectedDateIdx / (dailyActivity.length - 1)) * 200}
                    y1={0}
                    x2={(auditSelectedDateIdx / (dailyActivity.length - 1)) * 200}
                    y2={24}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                  />
                )}
                {/* Hovered date indicator line (dashed) */}
                {auditHoveredDateIdx !== null && auditHoveredDateIdx !== auditSelectedDateIdx && (
                  <line
                    x1={(auditHoveredDateIdx / (dailyActivity.length - 1)) * 200}
                    y1={0}
                    x2={(auditHoveredDateIdx / (dailyActivity.length - 1)) * 200}
                    y2={24}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                )}
              </svg>
              <div className="activity-labels">
                <span>{dailyActivity[0]?.dateKey}</span>
                <span className={`activity-summary ${auditSelectedDateIdx !== null ? 'selected' : ''}`}>
                  {displayDate ? `${displayDate.dateKey}: ${displayDate.total} changes` : `${totalChanges} changes (14 days)`}
                </span>
                <span>Today</span>
              </div>
            </div>
            <div className="audit-timeline">
              {groupedEntries.map(([dateKey, entries], groupIdx) => (
                <div key={dateKey} className="timeline-date-group">
                  <div className="timeline-date-marker">
                    <span className="timeline-date">{dateKey}</span>
                  </div>
                  <div className="timeline-events">
                    {entries.map((entry, idx) => {
                      const userName = entry.user_email?.split('@')[0] || 'System';
                      const values = formatValues(entry);
                      const projectContext = entry.project_name || null;
                      const metricContext = entry.metric_name || null;
                      const isLeft = idx % 2 === 0;
                      const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                      return (
                        <div key={idx} className={`timeline-event ${isLeft ? 'left' : 'right'} action-${entry.action?.toLowerCase()}`}>
                          <div className="timeline-spur">
                            <div className="timeline-node">
                              {getActionIcon(entry.action)}
                            </div>
                          </div>
                          <details className="timeline-card">
                            <summary className="timeline-card-summary compact">
                              <span className="timeline-time">{time}</span>
                              <span className="timeline-user">{userName}</span>
                              <span className="timeline-verb">{getActionVerb(entry.action)}</span>
                              <span className="timeline-table">{formatTableName(entry.table_name)}</span>
                              {metricContext && <span className="timeline-metric">"{metricContext}"</span>}
                              {projectContext && <span className="timeline-project">in {projectContext}</span>}
                            </summary>
                            <div className="timeline-card-details">
                              {values.length > 0 ? (
                                <table className="audit-values-table">
                                  <thead>
                                    <tr>
                                      <th>Field</th>
                                      {entry.action === 'UPDATE' ? (
                                        <>
                                          <th>Before</th>
                                          <th>After</th>
                                        </>
                                      ) : (
                                        <th>Value</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {values.map((v, i) => (
                                      <tr key={i} className={v.changed === false ? 'unchanged' : 'changed'}>
                                        <td className="field-name">{v.field}</td>
                                        {entry.action === 'UPDATE' ? (
                                          <>
                                            <td className={`field-old ${v.changed === false ? 'dimmed' : ''}`}>{v.from || '—'}</td>
                                            <td className={`field-new ${v.changed === false ? 'dimmed' : ''}`}>{v.to}</td>
                                          </>
                                        ) : (
                                          <td className="field-value">{v.value}</td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="audit-no-details">No additional details</div>
                              )}
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditPanel;
