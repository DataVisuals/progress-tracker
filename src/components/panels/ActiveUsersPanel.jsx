import React from 'react';
import { MdPeople, MdWarning } from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const ActiveUsersPanel = ({
  panelId,
  index,
  isAdmin,
  forDock,
  activeUsers,
  userActivity,
  userActivityDays,
  setUserActivityDays,
  setUserActivity,
  api
}) => {
  if (!isAdmin) return null;

  // Color palette for activity types
  const activityColors = {
    'CREATE_projects': '#047857', 'UPDATE_projects': '#10b981', 'DELETE_projects': '#6ee7b7',
    'CREATE_project_links': '#4d7c0f', 'UPDATE_project_links': '#84cc16', 'DELETE_project_links': '#bef264',
    'CREATE_metrics': '#1e40af', 'UPDATE_metrics': '#3b82f6', 'DELETE_metrics': '#93c5fd',
    'CREATE_metric_periods': '#4c1d95', 'UPDATE_metric_periods': '#8b5cf6', 'DELETE_metric_periods': '#c4b5fd',
    'CREATE_comments': '#b45309', 'UPDATE_comments': '#f59e0b', 'DELETE_comments': '#fcd34d',
    'CREATE_feedback': '#9d174d', 'UPDATE_feedback': '#ec4899', 'DELETE_feedback': '#f9a8d4',
    'CREATE_portfolios': '#0e7490', 'UPDATE_portfolios': '#06b6d4', 'DELETE_portfolios': '#67e8f9',
    'CREATE_craids': '#991b1b', 'UPDATE_craids': '#ef4444', 'DELETE_craids': '#fca5a5',
    'CREATE_users': '#334155', 'UPDATE_users': '#64748b', 'DELETE_users': '#cbd5e1',
    'IMPORT_projects': '#7e22ce'
  };
  const getActivityColor = (type) => activityColors[type] || '#94a3b8';
  const formatActivityType = (type) => {
    const parts = type.split('_');
    const action = parts[0].toLowerCase();
    const table = parts.slice(1).join('_').replace(/_/g, ' ');
    return `${action} ${table}`;
  };

  // Transform activity data for chart
  const getActivityChartData = () => {
    if (!userActivity?.activityBreakdown) return [];
    return userActivity.activityBreakdown
      .map(user => {
        // Truncate long names to fit on single line
        const displayName = user.user_name.length > 18
          ? user.user_name.substring(0, 16) + '...'
          : user.user_name;
        const chartItem = { name: displayName, fullName: user.user_name, total: 0 };
        Object.entries(user.activities).forEach(([type, count]) => {
          chartItem[type] = count;
          chartItem.total += count;
        });
        return chartItem;
      })
      .sort((a, b) => b.total - a.total);
  };

  // Timeline chart data - top 10 users + Others
  const getTimelineUsers = () => {
    if (!userActivity?.timeline) return [];
    // Calculate total activity per user
    const userTotals = {};
    userActivity.timeline.forEach(item => {
      userTotals[item.user_name] = (userTotals[item.user_name] || 0) + item.count;
    });
    // Sort users by total activity and get top 10
    const sortedUsers = Object.entries(userTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    const top10 = sortedUsers.slice(0, 10);
    const hasOthers = sortedUsers.length > 10;
    return hasOthers ? [...top10, 'Others'] : top10;
  };

  const getTimelineChartData = () => {
    if (!userActivity?.timeline) return [];
    const allUsers = getTimelineUsers();
    const top10Users = allUsers.filter(u => u !== 'Others');
    const hasOthers = allUsers.includes('Others');

    const byDate = {};
    userActivity.timeline.forEach(item => {
      if (!byDate[item.date]) byDate[item.date] = { date: item.date };
      if (top10Users.includes(item.user_name)) {
        byDate[item.date][item.user_name] = item.count;
      } else if (hasOthers) {
        byDate[item.date]['Others'] = (byDate[item.date]['Others'] || 0) + item.count;
      }
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  };

  const userColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

  // Fullscreen view: logged-in users list + activity charts
  if (forDock) {
    return (
      <div key={panelId} className={`home-quadrant active-users-quadrant fullscreen-users panel-${index + 1}`}>
        <div className="quadrant-content users-fullscreen-layout">
          {/* Top row: Activity by User (left) + Logged in Users (right) */}
          <div className="users-top-row">
            {/* Activity by User Chart */}
            <div className="activity-by-user-section">
              <div className="section-header">
                <h3>Activity by User</h3>
                <select
                  value={userActivityDays}
                  onChange={(e) => {
                    setUserActivityDays(parseInt(e.target.value));
                    api.get(`/admin/user-activity?days=${e.target.value}`)
                      .then(res => setUserActivity(res.data))
                      .catch(err => console.log('Failed to reload activity:', err));
                  }}
                  className="activity-days-select"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              {!userActivity ? (
                <div className="loading-state">Loading...</div>
              ) : userActivity.error ? (
                <div className="empty-state compact">
                  <MdWarning className="empty-icon" />
                  <p>Unable to load</p>
                </div>
              ) : userActivity.activityTypes?.length > 0 ? (
                <div className="chart-scroll-container">
                  <ResponsiveContainer width="100%" height={Math.max(200, Math.min(getActivityChartData().length * 22, 280))}>
                    <BarChart
                      data={getActivityChartData().slice(0, 12)}
                      layout="vertical"
                      margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                      barSize={10}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} interval={0} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const total = payload.reduce((sum, e) => sum + (e.value || 0), 0);
                          const fullName = payload[0]?.payload?.fullName || payload[0]?.payload?.name;
                          return (
                            <div className="activity-tooltip">
                              <p className="tooltip-label">{fullName}</p>
                              <p className="tooltip-total">Total: {total}</p>
                              <div className="tooltip-breakdown">
                                {payload.filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 6).map((e, i) => (
                                  <div key={i} className="tooltip-item">
                                    <span className="tooltip-color" style={{ backgroundColor: e.color }} />
                                    <span className="tooltip-name">{formatActivityType(e.dataKey)}</span>
                                    <span className="tooltip-value">{e.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }}
                      />
                      {userActivity.activityTypes.map((type) => (
                        <Bar key={type} dataKey={type} stackId="a" fill={getActivityColor(type)} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state compact">No activity data</div>
              )}
            </div>

            {/* Logged in Users list */}
            <div className="users-list-section">
              <h3>Logged In <span className="subtitle">Last 30 min</span></h3>
              {!activeUsers ? (
                <div className="loading-state">Loading...</div>
              ) : activeUsers.error ? (
                <div className="empty-state compact">
                  <MdWarning className="empty-icon" />
                  <p>Unable to load</p>
                </div>
              ) : activeUsers.count === 0 ? (
                <div className="empty-state compact">
                  <MdPeople className="empty-icon" />
                  <p>No active users</p>
                </div>
              ) : (
                <div className="active-users-list">
                  {activeUsers.users?.map((user, idx) => (
                    <div key={idx} className="active-user-item">
                      <div className="active-user-info">
                        <span className="active-user-name">{user.name}</span>
                        <span className="active-user-email">{user.email}</span>
                      </div>
                      <span className="active-user-time">{formatTimestamp(user.lastActivity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom row: Timeline (full width) */}
          {userActivity && !userActivity.error && getTimelineChartData().length > 0 && (
            <div className="timeline-section">
              <h3>Activity Timeline</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={getTimelineChartData()} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce((sum, e) => sum + (e.value || 0), 0);
                      return (
                        <div className="activity-tooltip">
                          <p className="tooltip-label">{label}</p>
                          <p className="tooltip-total">Total: {total}</p>
                          <div className="tooltip-breakdown">
                            {payload.filter(e => e.value > 0).sort((a, b) => b.value - a.value).map((e, i) => (
                              <div key={i} className="tooltip-item">
                                <span className="tooltip-color" style={{ background: e.color }} />
                                <span className="tooltip-name">{e.dataKey}</span>
                                <span className="tooltip-value">{e.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '9px', paddingLeft: '80px', paddingTop: '12px' }} align="left" />
                  {getTimelineUsers().map((user, idx) => (
                    <Bar key={user} dataKey={user} stackId="timeline" fill={user === 'Others' ? '#9ca3af' : userColors[idx % userColors.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal panel view
  return (
    <div key={panelId} className={`home-quadrant active-users-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdPeople className="quadrant-icon" />
        <h2>Active Users</h2>
        <span className="quadrant-subtitle">Last 30 minutes</span>
      </div>
      <div className="quadrant-content">
        {!activeUsers ? (
          <div className="loading-state">Loading...</div>
        ) : activeUsers.error ? (
          <div className="empty-state">
            <MdWarning className="empty-icon" />
            <p>Unable to load active users</p>
            <span>{activeUsers.error}</span>
          </div>
        ) : activeUsers.count === 0 ? (
          <div className="empty-state">
            <MdPeople className="empty-icon" />
            <p>No active users</p>
            <span>No users active in the last 30 minutes</span>
          </div>
        ) : (
          <div className="active-users-list">
            <div className="active-users-count">{activeUsers.count} active user{activeUsers.count !== 1 ? 's' : ''}</div>
            {activeUsers.users?.map((user, idx) => (
              <div key={idx} className="active-user-item">
                <div className="active-user-info">
                  <span className="active-user-name">{user.name}</span>
                  <span className="active-user-email">{user.email}</span>
                </div>
                <span className="active-user-time">{formatTimestamp(user.lastActivity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveUsersPanel;
