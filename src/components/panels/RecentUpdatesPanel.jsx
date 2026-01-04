import React, { useState, useEffect, useMemo } from 'react';
import { MdFiberNew, MdAdd, MdEdit, MdRemove, MdChevronRight, MdUpdate } from 'react-icons/md';
import { api } from '../../api/client';

const RecentUpdatesPanel = ({
  panelId,
  index,
  onNavigateToProject,
  darkMode,
  forDock = false,
  selectedSpace,
  spaces,
  portfolios,
  projects
}) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentUpdates();
  }, [selectedSpace]);

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

  // Get project IDs for the selected space
  const spaceProjectIds = useMemo(() => {
    if (!selectedSpace || selectedSpace === 'all') return null;
    if (!portfolios || !projects) return null;

    // Get portfolio IDs for the selected space
    const spacePortfolioIds = portfolios
      .filter(p => p.space_id === parseInt(selectedSpace))
      .map(p => p.id);

    // Get project IDs with those portfolios
    return Object.entries(projects)
      .filter(([_, project]) => spacePortfolioIds.includes(project.portfolio_id))
      .map(([id]) => parseInt(id));
  }, [selectedSpace, portfolios, projects]);

  // Get current space name for empty state
  const currentSpaceName = selectedSpace === 'all'
    ? 'All Spaces'
    : spaces?.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space';

  // Group updates by space or portfolio, then by project and summarize
  const groupedUpdates = useMemo(() => {
    const projectGroups = {};
    const now = new Date();
    const groupBySpace = selectedSpace === 'all';

    updates.forEach(update => {
      // Skip entries without project context
      if (!update.project_name) return;

      // Filter by space if a specific space is selected
      if (spaceProjectIds !== null && update.project_id) {
        if (!spaceProjectIds.includes(update.project_id)) return;
      }

      const projectKey = update.project_name;
      if (!projectGroups[projectKey]) {
        projectGroups[projectKey] = {
          projectName: update.project_name,
          projectId: update.project_id || null,
          portfolioId: null,
          portfolioName: null,
          portfolioColor: null,
          spaceId: null,
          spaceName: null,
          metrics: {},
          latestUpdate: null,
          updateCount: 0
        };
      }

      // Get portfolio and space info from projects data
      if (update.project_id && projects) {
        const projectData = projects[update.project_id];
        if (projectData) {
          projectGroups[projectKey].portfolioId = projectData.portfolio_id;
          projectGroups[projectKey].portfolioName = projectData.portfolio_name;
          projectGroups[projectKey].portfolioColor = projectData.portfolio_color;

          // Get space from portfolio
          if (portfolios) {
            const portfolio = portfolios.find(p => p.id === projectData.portfolio_id);
            if (portfolio && spaces) {
              const space = spaces.find(s => s.id === portfolio.space_id);
              if (space) {
                projectGroups[projectKey].spaceId = space.id;
                projectGroups[projectKey].spaceName = space.name;
              }
            }
          }
        }
      }

      // Track latest update time
      const updateTime = new Date(update.created_at);
      if (!projectGroups[projectKey].latestUpdate || updateTime > projectGroups[projectKey].latestUpdate) {
        projectGroups[projectKey].latestUpdate = updateTime;
      }

      projectGroups[projectKey].updateCount++;

      // Group metric-related updates
      if (update.metric_name) {
        const metricKey = update.metric_name;
        if (!projectGroups[projectKey].metrics[metricKey]) {
          projectGroups[projectKey].metrics[metricKey] = {
            metricName: metricKey,
            actions: [],
            latestUpdate: null
          };
        }

        projectGroups[projectKey].metrics[metricKey].actions.push({
          action: update.action,
          tableName: update.table_name,
          timestamp: updateTime,
          user: update.user_email?.split('@')[0] || 'System',
          description: update.description
        });

        if (!projectGroups[projectKey].metrics[metricKey].latestUpdate ||
            updateTime > projectGroups[projectKey].metrics[metricKey].latestUpdate) {
          projectGroups[projectKey].metrics[metricKey].latestUpdate = updateTime;
        }
      }
    });

    // Group by space or portfolio
    const spaceOrPortfolioGroups = {};
    Object.values(projectGroups).forEach(project => {
      let groupKey, groupName, groupColor;

      if (groupBySpace) {
        groupKey = project.spaceId || 'none';
        groupName = project.spaceName || 'No Space';
        groupColor = null;
      } else {
        groupKey = project.portfolioId || 'none';
        groupName = project.portfolioName || 'No Portfolio';
        groupColor = project.portfolioColor;
      }

      if (!spaceOrPortfolioGroups[groupKey]) {
        spaceOrPortfolioGroups[groupKey] = {
          groupId: groupKey !== 'none' ? groupKey : null,
          groupName,
          groupColor,
          items: []
        };
      }

      spaceOrPortfolioGroups[groupKey].items.push(project);
    });

    // Sort items within each group by latest update
    Object.values(spaceOrPortfolioGroups).forEach(group => {
      group.items.sort((a, b) => (b.latestUpdate || 0) - (a.latestUpdate || 0));
      // Limit items per group
      group.items = group.items.slice(0, forDock ? 20 : 8);
    });

    // Sort groups: named groups first alphabetically, then "No Space/Portfolio"
    return Object.values(spaceOrPortfolioGroups).sort((a, b) => {
      if (!a.groupId) return 1;
      if (!b.groupId) return -1;
      return a.groupName.localeCompare(b.groupName);
    });
  }, [updates, forDock, spaceProjectIds, selectedSpace, projects, portfolios, spaces]);

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
    <div key={panelId} className={`home-quadrant recent-updates-quadrant ${forDock ? 'fullscreen-updates' : ''} panel-${index + 1}`}>
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
            <span>No updates for {currentSpaceName}</span>
          </div>
        ) : (
          <div className="recent-updates-list">
            {groupedUpdates.map((groupData, groupIdx) => (
              <div key={groupIdx} className="updates-group">
                <div className="updates-group-header">
                  {groupData.groupColor && <span className="group-color-dot" style={{ backgroundColor: groupData.groupColor }} />}
                  <span className="group-name">{groupData.groupName}</span>
                  <span className="updates-count">({groupData.items.length})</span>
                </div>
                {groupData.items.map((group, idx) => {
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
                          {metricList.slice(0, forDock ? 10 : 5).map((metric, midx) => {
                            const latestAction = metric.actions[0];
                            const isMetricRecent = isRecent(metric.latestUpdate);

                            return (
                              <div
                                key={midx}
                                className="update-metric-item"
                                onClick={() => handleMetricClick(group, metric.metricName)}
                                style={{ cursor: group.projectId ? 'pointer' : 'default' }}
                              >
                                <div className="update-metric-header">
                                  {getActionIcon(latestAction?.action)}
                                  <span className={`update-metric-name ${isMetricRecent ? 'recently-changed' : ''}`}>{metric.metricName}</span>
                                  <span className="update-metric-detail">
                                    {metric.actions.length > 1
                                      ? `${metric.actions.length} changes`
                                      : latestAction?.user}
                                  </span>
                                </div>
                                {latestAction?.description && (
                                  <div className="update-metric-description">
                                    {latestAction.description}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {metricList.length > (forDock ? 10 : 5) && (
                            <div className="update-more">
                              +{metricList.length - (forDock ? 10 : 5)} more metrics
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentUpdatesPanel;
