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

  // Color palette for different activity types
  const activityColors = {
    'CREATE_projects': '#10b981',
    'UPDATE_projects': '#3b82f6',
    'DELETE_projects': '#ef4444',
    'CREATE_metrics': '#8b5cf6',
    'UPDATE_metrics': '#6366f1',
    'DELETE_metrics': '#f43f5e',
    'CREATE_metric_periods': '#14b8a6',
    'UPDATE_metric_periods': '#06b6d4',
    'DELETE_metric_periods': '#f97316',
    'CREATE_comments': '#eab308',
    'UPDATE_comments': '#a3e635',
    'DELETE_comments': '#f87171',
    'CREATE_feedback': '#ec4899',
    'UPDATE_feedback': '#d946ef',
    'DELETE_feedback': '#fb7185',
    'CREATE_portfolios': '#0ea5e9',
    'UPDATE_portfolios': '#38bdf8',
    'DELETE_portfolios': '#f472b6',
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
                <ResponsiveContainer width="100%" height={Math.max(250, data.users.length * 28)}>
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
