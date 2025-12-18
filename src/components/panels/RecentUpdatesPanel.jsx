import React, { useState, useEffect, useMemo } from 'react';
import { MdFiberNew, MdAdd, MdEdit, MdRemove, MdChevronRight, MdUpdate } from 'react-icons/md';
import { api } from '../../api/client';

const RecentUpdatesPanel = ({
  panelId,
  index,
  onNavigateToProject,
  darkMode,
  forDock = false
}) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentUpdates();
  }, []);

  const loadRecentUpdates = async () => {
    try {
      setLoading(true);
      // Get recent audit entries with project context
      const response = await api.getAuditLog({ limit: forDock ? 100 : 50 });
      setUpdates(response.data);
    } catch (err) {
      console.error('Failed to load recent updates:', err);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  // Group updates by project and summarize
  const groupedUpdates = useMemo(() => {
    const groups = {};
    const now = new Date();

    updates.forEach(update => {
      // Skip entries without project context
      if (!update.project_name) return;

      const projectKey = update.project_name;
      if (!groups[projectKey]) {
        groups[projectKey] = {
          projectName: update.project_name,
          projectId: update.project_id || null, // Use project_id from enriched audit entry
          metrics: {},
          latestUpdate: null,
          updateCount: 0
        };
      }

      // Update project_id if we have it (some entries may have it, some may not)
      if (update.project_id && !groups[projectKey].projectId) {
        groups[projectKey].projectId = update.project_id;
      }

      // Track latest update time
      const updateTime = new Date(update.created_at);
      if (!groups[projectKey].latestUpdate || updateTime > groups[projectKey].latestUpdate) {
        groups[projectKey].latestUpdate = updateTime;
      }

      groups[projectKey].updateCount++;

      // Group metric-related updates
      if (update.metric_name) {
        const metricKey = update.metric_name;
        if (!groups[projectKey].metrics[metricKey]) {
          groups[projectKey].metrics[metricKey] = {
            metricName: metricKey,
            actions: [],
            latestUpdate: null
          };
        }

        groups[projectKey].metrics[metricKey].actions.push({
          action: update.action,
          tableName: update.table_name,
          timestamp: updateTime,
          user: update.user_email?.split('@')[0] || 'System',
          description: update.description
        });

        if (!groups[projectKey].metrics[metricKey].latestUpdate ||
            updateTime > groups[projectKey].metrics[metricKey].latestUpdate) {
          groups[projectKey].metrics[metricKey].latestUpdate = updateTime;
        }
      }
    });

    // Convert to array and sort by latest update
    return Object.values(groups)
      .sort((a, b) => (b.latestUpdate || 0) - (a.latestUpdate || 0))
      .slice(0, forDock ? 20 : 8);
  }, [updates, forDock]);

  const formatRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 8) return `${diffWeeks}w ago`;
    return `${Math.floor(diffWeeks / 4)}mo ago`;
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE': return <MdAdd className="update-action-icon create" />;
      case 'UPDATE': return <MdEdit className="update-action-icon update" />;
      case 'DELETE': return <MdRemove className="update-action-icon delete" />;
      default: return <MdUpdate className="update-action-icon" />;
    }
  };

  const getActionSummary = (metrics) => {
    const metricList = Object.values(metrics);
    if (metricList.length === 0) return null;

    const totalActions = metricList.reduce((sum, m) => sum + m.actions.length, 0);
    const actionTypes = {};
    metricList.forEach(m => {
      m.actions.forEach(a => {
        actionTypes[a.action] = (actionTypes[a.action] || 0) + 1;
      });
    });

    const parts = [];
    if (actionTypes.UPDATE) parts.push(`${actionTypes.UPDATE} updates`);
    if (actionTypes.CREATE) parts.push(`${actionTypes.CREATE} new`);
    if (actionTypes.DELETE) parts.push(`${actionTypes.DELETE} deleted`);

    return parts.join(', ');
  };

  const handleProjectClick = (group) => {
    if (onNavigateToProject && group.projectId) {
      onNavigateToProject(group.projectId);
    }
  };

  const handleMetricClick = (group, metricName) => {
    if (onNavigateToProject && group.projectId) {
      onNavigateToProject(group.projectId, metricName);
    }
  };

  // Check if update is recent (same day)
  const isRecent = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div key={panelId} className={`home-quadrant recent-updates-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdFiberNew className="quadrant-icon" />
        <h2>Recent Updates</h2>
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : groupedUpdates.length === 0 ? (
          <div className="empty-state">
            <MdFiberNew className="empty-icon" />
            <p>No recent updates</p>
          </div>
        ) : (
          <div className="recent-updates-list">
            {groupedUpdates.map((group, idx) => {
              const metricList = Object.values(group.metrics);
              const actionSummary = getActionSummary(group.metrics);
              const isRecentUpdate = isRecent(group.latestUpdate);

              return (
                <div
                  key={idx}
                  className={`recent-update-item ${isRecentUpdate ? 'very-recent' : ''}`}
                >
                  <div
                    className="update-project-header"
                    onClick={() => handleProjectClick(group)}
                    style={{ cursor: group.projectId ? 'pointer' : 'default' }}
                  >
                    <span className="update-project-name">{group.projectName}</span>
                    <span className="update-time">{formatDateTime(group.latestUpdate)}</span>
                    <span className="update-relative-time">({formatRelativeTime(group.latestUpdate)})</span>
                    {group.projectId && <MdChevronRight className="update-nav-icon" />}
                  </div>

                  {metricList.length > 0 && (
                    <div className="update-metrics">
                      {metricList.slice(0, forDock ? 5 : 3).map((metric, midx) => {
                        const latestAction = metric.actions[0];
                        const isMetricRecent = isRecent(metric.latestUpdate);

                        return (
                          <div
                            key={midx}
                            className="update-metric-item"
                            onClick={() => handleMetricClick(group, metric.metricName)}
                            style={{ cursor: group.projectId ? 'pointer' : 'default' }}
                          >
                            {getActionIcon(latestAction?.action)}
                            <span className={`update-metric-name ${isMetricRecent ? 'recently-changed' : ''}`}>{metric.metricName}</span>
                            <span className="update-metric-detail">
                              {metric.actions.length > 1
                                ? `${metric.actions.length} changes`
                                : latestAction?.user}
                            </span>
                          </div>
                        );
                      })}
                      {metricList.length > (forDock ? 5 : 3) && (
                        <div className="update-more">
                          +{metricList.length - (forDock ? 5 : 3)} more metrics
                        </div>
                      )}
                    </div>
                  )}

                  {actionSummary && (
                    <div className="update-summary">{actionSummary}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentUpdatesPanel;
