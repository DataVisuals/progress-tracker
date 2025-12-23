import React, { useState, useEffect, useMemo } from 'react';
import { MdPeople, MdWarning, MdAutoAwesome } from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { calculateClarityScore } from '../../utils/clarityScore';
import { api as apiClient } from '../../api/client';
import './ClarityPanel.css';

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

const GemIcon = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`gem-icon ${className}`}
  >
    <path d="M12 2L4 8L12 10L20 8L12 2Z" opacity="0.9" />
    <path d="M4 8L12 10L12 22L4 8Z" opacity="0.7" />
    <path d="M20 8L12 10L12 22L20 8Z" opacity="0.5" />
    <path
      d="M12 2L4 8L12 22L20 8L12 2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.3"
    />
    <path d="M12 10L4 8L20 8L12 10Z" fill="white" opacity="0.2" />
  </svg>
);

const getScoreClass = (score) => {
  if (score >= 4) return 'clarity-good';
  if (score >= 3) return 'clarity-average';
  return 'clarity-poor';
};

const ActiveUsersPanel = ({
  panelId,
  index,
  isAdmin,
  forDock,
  activeUsers,
  inactivePMs,
  userActivity,
  userActivityDays,
  setUserActivityDays,
  setUserActivity,
  api
}) => {
  const [comments, setComments] = useState([]);
  const [clarityLoading, setClarityLoading] = useState(true);
  const [clarityError, setClarityError] = useState(null);
  const [highlightedUser, setHighlightedUser] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    loadComments();
  }, [isAdmin]);

  const loadComments = async () => {
    try {
      setClarityLoading(true);
      const response = await apiClient.getCommentsByUser();
      setComments(response.data);
      setClarityError(null);
    } catch (err) {
      console.error('Failed to load clarity data:', err);
      setClarityError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setClarityLoading(false);
    }
  };

  // Calculate average clarity score per user
  const userRankings = useMemo(() => {
    if (!comments || comments.length === 0) return [];

    const userComments = {};
    comments.forEach(comment => {
      if (!comment.created_by) return;
      if (!userComments[comment.created_by]) {
        userComments[comment.created_by] = {
          userId: comment.created_by,
          userName: comment.user_name || 'Unknown',
          userEmail: comment.user_email,
          comments: [],
          totalScore: 0,
          commentCount: 0
        };
      }
      const { score } = calculateClarityScore(comment.comment_text, 'comment');
      userComments[comment.created_by].comments.push({
        text: comment.comment_text,
        score
      });
      userComments[comment.created_by].totalScore += score;
      userComments[comment.created_by].commentCount++;
    });

    const rankings = Object.values(userComments)
      .filter(u => u.commentCount >= 1)
      .map(u => ({
        ...u,
        avgScore: Math.round((u.totalScore / u.commentCount) * 10) / 10
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return rankings;
  }, [comments]);

  const top5 = userRankings.slice(0, 5);
  const bottom5 = [...userRankings].reverse().slice(0, 5);

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

  // Helper to format time since last activity
  const formatTimeSince = (daysSinceLogin, neverLoggedIn) => {
    if (neverLoggedIn) return 'Never logged in';
    if (daysSinceLogin === 0) return 'Today';
    if (daysSinceLogin === 1) return '1 day ago';
    if (daysSinceLogin < 7) return `${daysSinceLogin} days ago`;
    if (daysSinceLogin < 30) return `${Math.floor(daysSinceLogin / 7)} week${Math.floor(daysSinceLogin / 7) > 1 ? 's' : ''} ago`;
    if (daysSinceLogin < 365) return `${Math.floor(daysSinceLogin / 30)} month${Math.floor(daysSinceLogin / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(daysSinceLogin / 365)} year${Math.floor(daysSinceLogin / 365) > 1 ? 's' : ''} ago`;
  };

  // Fullscreen view: 4 quadrants layout
  if (forDock) {
    return (
      <div key={panelId} className={`home-quadrant active-users-quadrant fullscreen-users panel-${index + 1}`}>
        <div className="quadrant-content users-fullscreen-layout">
          {/* 2x2 Grid Layout */}
          <div className="users-grid-layout">
            {/* Top Left: Activity by User */}
            <div className="users-quadrant top-left">
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
            </div>

            {/* Top Right: Logged in Users */}
            <div className="users-quadrant top-right">
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

            {/* Bottom Left: Clarity Rankings (Compact) */}
            <div className="users-quadrant bottom-left">
            <div className="section-header">
              <h3>Clarity Rankings</h3>
            </div>
            {clarityLoading ? (
              <div className="loading-state">Loading...</div>
            ) : clarityError ? (
              <div className="clarity-error-small">{clarityError}</div>
            ) : userRankings.length === 0 ? (
              <div className="clarity-empty-small">No comment data</div>
            ) : (
              <div className="clarity-compact-quadrant">
                <div className="clarity-mini-list">
                  {userRankings.slice(0, 5).map((user, idx) => (
                    <div key={user.userId} className="clarity-mini-item">
                      <span className="clarity-mini-rank">{idx + 1}</span>
                      <div className={`clarity-mini-gem ${getScoreClass(user.avgScore)}`}>
                        <GemIcon size={12} />
                      </div>
                      <span className="clarity-mini-name">{user.userName}</span>
                      <span className={`clarity-mini-score ${getScoreClass(user.avgScore)}`}>
                        {user.avgScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* Bottom Right: Asleep at the Wheel (Inactive PMs) */}
            <div className="users-quadrant bottom-right">
            <div className="section-header">
              <h3>Asleep at the Wheel</h3>
            </div>
            {!inactivePMs ? (
              <div className="loading-state">Loading...</div>
            ) : inactivePMs.error ? (
              <div className="empty-state compact">
                <MdWarning className="empty-icon" />
                <p>Unable to load</p>
              </div>
            ) : inactivePMs.count === 0 ? (
              <div className="empty-state compact">
                <p>All PMs are active!</p>
              </div>
            ) : (
              <div className="inactive-pms-list">
                {inactivePMs.pms?.slice(0, 10).map((pm, idx) => (
                  <div key={pm.id} className="inactive-pm-item">
                    <div className="inactive-pm-info">
                      <span className="inactive-pm-name">{pm.name}</span>
                      <span className="inactive-pm-email">{pm.email}</span>
                    </div>
                    <span className="inactive-pm-time">{formatTimeSince(pm.daysSinceLogin, pm.neverLoggedIn)}</span>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* Activity Timeline - Full Width Below Grid */}
          {userActivity && !userActivity.error && getTimelineChartData().length > 0 && (
            <div className="timeline-section">
              <h3>Activity Timeline</h3>
              <ResponsiveContainer width="100%" height={260}>
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
                  <Legend
                    wrapperStyle={{ fontSize: '9px', paddingLeft: '80px', paddingTop: '12px', cursor: 'pointer' }}
                    align="left"
                    onClick={(e) => {
                      if (e && e.dataKey) {
                        setHighlightedUser(highlightedUser === e.dataKey ? null : e.dataKey);
                      }
                    }}
                  />
                  {getTimelineUsers().map((user, idx) => (
                    <Bar
                      key={user}
                      dataKey={user}
                      stackId="timeline"
                      fill={user === 'Others' ? '#9ca3af' : userColors[idx % userColors.length]}
                      opacity={highlightedUser ? (highlightedUser === user ? 1 : 0.2) : 1}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        {/* Old clarity section removed - now in bottom-left quadrant */}
      </div>
    );
  }

  // Normal panel view
  return (
    <div key={panelId} className={`home-quadrant active-users-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdPeople className="quadrant-icon" />
        <h2>Users</h2>
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

        {/* Clarity Rankings */}
        <div className="clarity-section">
          <div className="clarity-section-header">
            <MdAutoAwesome className="clarity-icon" />
            <h3>Clarity Rankings</h3>
          </div>
          {clarityLoading ? (
            <div className="clarity-loading-small">Loading...</div>
          ) : clarityError ? (
            <div className="clarity-error-small">{clarityError}</div>
          ) : userRankings.length === 0 ? (
            <div className="clarity-empty-small">No comment data</div>
          ) : (
            <div className="clarity-compact-rankings">
              <div className="clarity-compact-column">
                <div className="clarity-compact-header top">Top 5</div>
                {top5.map((user, idx) => (
                  <div key={user.userId} className="clarity-compact-item">
                    <span className="clarity-compact-rank">{idx + 1}</span>
                    <div className={`clarity-compact-gem ${getScoreClass(user.avgScore)}`}>
                      <GemIcon size={14} />
                    </div>
                    <span className="clarity-compact-name">{user.userName}</span>
                    <span className={`clarity-compact-score ${getScoreClass(user.avgScore)}`}>
                      {user.avgScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="clarity-compact-column">
                <div className="clarity-compact-header bottom">Bottom 5</div>
                {bottom5.map((user, idx) => (
                  <div key={user.userId} className="clarity-compact-item">
                    <span className="clarity-compact-rank">{userRankings.length - idx}</span>
                    <div className={`clarity-compact-gem ${getScoreClass(user.avgScore)}`}>
                      <GemIcon size={14} />
                    </div>
                    <span className="clarity-compact-name">{user.userName}</span>
                    <span className={`clarity-compact-score ${getScoreClass(user.avgScore)}`}>
                      {user.avgScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveUsersPanel;
