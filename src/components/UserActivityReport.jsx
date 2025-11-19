import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './UserActivityReport.css';

const UserActivityReport = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/user-activity?days=${days}`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load user activity:', err);
      setError(err.response?.data?.error || 'Failed to load user activity data');
    } finally {
      setLoading(false);
    }
  };

  // Color palette for different activity types - distinct colors for each
  const activityColors = {
    // Projects - emerald greens
    'CREATE_projects': '#047857',
    'UPDATE_projects': '#10b981',
    'DELETE_projects': '#6ee7b7',
    // Project links - lime greens
    'CREATE_project_links': '#4d7c0f',
    'UPDATE_project_links': '#84cc16',
    'DELETE_project_links': '#bef264',
    // Metrics - deep blues
    'CREATE_metrics': '#1e40af',
    'UPDATE_metrics': '#3b82f6',
    'DELETE_metrics': '#93c5fd',
    // Metric periods - indigo/violet
    'CREATE_metric_periods': '#4c1d95',
    'UPDATE_metric_periods': '#8b5cf6',
    'DELETE_metric_periods': '#c4b5fd',
    // Comments - amber/orange
    'CREATE_comments': '#b45309',
    'UPDATE_comments': '#f59e0b',
    'DELETE_comments': '#fcd34d',
    // Feedback - pink/rose
    'CREATE_feedback': '#9d174d',
    'UPDATE_feedback': '#ec4899',
    'DELETE_feedback': '#f9a8d4',
    // Portfolios - cyan/teal
    'CREATE_portfolios': '#0e7490',
    'UPDATE_portfolios': '#06b6d4',
    'DELETE_portfolios': '#67e8f9',
    // CRAIDs - red/crimson
    'CREATE_craids': '#991b1b',
    'UPDATE_craids': '#ef4444',
    'DELETE_craids': '#fca5a5',
    // Users - slate/gray
    'CREATE_users': '#334155',
    'UPDATE_users': '#64748b',
    'DELETE_users': '#cbd5e1',
    // Project permissions - sky blue
    'CREATE_project_permissions': '#0369a1',
    'UPDATE_project_permissions': '#0ea5e9',
    'DELETE_project_permissions': '#7dd3fc',
    // Import - special purple
    'IMPORT_projects': '#7e22ce',
  };

  const getColor = (activityType) => {
    return activityColors[activityType] || '#94a3b8';
  };

  const formatActivityType = (type) => {
    const parts = type.split('_');
    const action = parts[0].toLowerCase();
    const table = parts.slice(1).join('_').replace(/_/g, ' ');
    return `${action} ${table}`;
  };

  // Transform data for stacked bar chart
  const getChartData = () => {
    if (!data?.activityBreakdown) return [];

    return data.activityBreakdown
      .map(user => {
        const chartItem = {
          name: user.user_name,
          total: 0,
        };

        Object.entries(user.activities).forEach(([type, count]) => {
          chartItem[type] = count;
          chartItem.total += count;
        });

        return chartItem;
      })
      .sort((a, b) => b.total - a.total);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
      return (
        <div className="activity-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-total">Total: {total}</p>
          <div className="tooltip-breakdown">
            {payload
              .filter(entry => entry.value > 0)
              .sort((a, b) => b.value - a.value)
              .map((entry, index) => (
                <div key={index} className="tooltip-item">
                  <span
                    className="tooltip-color"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="tooltip-name">{formatActivityType(entry.dataKey)}</span>
                  <span className="tooltip-value">{entry.value}</span>
                </div>
              ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content user-activity-modal">
        <div className="modal-header">
          <h2>User Activity Report</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="activity-controls">
          <label>
            Time Period:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </label>
        </div>

        {loading && (
          <div className="loading-state">Loading activity data...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {data && !loading && (
          <div className="activity-content">
            {/* Stacked Bar Chart */}
            {data.activityTypes.length > 0 ? (
              <div className="chart-container">
                <div className="chart-scroll-wrapper">
                  <ResponsiveContainer width="100%" height={Math.max(250, getChartData().length * 28)}>
                    <BarChart
                      data={getChartData()}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                      barSize={16}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={90}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => formatActivityType(value)}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      {data.activityTypes.map((type) => (
                        <Bar
                          key={type}
                          dataKey={type}
                          stackId="a"
                          fill={getColor(type)}
                          name={type}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="no-data">No activity in this period</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivityReport;
