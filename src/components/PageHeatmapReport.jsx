import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import './PageHeatmapReport.css';

const PageHeatmapReport = ({ onClose, selectedSpace = 'all', spaces = [] }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days, selectedSpace]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const spaceParam = selectedSpace !== 'all' ? `&space_id=${selectedSpace}` : '';
      const response = await api.get(`/admin/page-heatmap?days=${days}${spaceParam}`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load page heatmap:', err);
      setError(err.response?.data?.error || 'Failed to load page heatmap data');
    } finally {
      setLoading(false);
    }
  };

  // Format path names for display
  const formatPath = (path) => {
    // Remove "Project: " prefix for cleaner display
    if (path.startsWith('Project: ')) {
      return path.substring(9); // Remove "Project: " (9 characters)
    }
    if (path === '/') return 'Home';
    return path.replace(/^\//, '').split('/').map(part =>
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' / ') || 'Unknown';
  };

  // Color scale for heatmap (from cold to hot)
  const getHeatColor = (value, maxValue) => {
    const ratio = value / maxValue;
    if (ratio > 0.8) return '#dc2626'; // Hot - red
    if (ratio > 0.6) return '#f59e0b'; // Warm - orange
    if (ratio > 0.4) return '#fbbf24'; // Moderate - yellow
    if (ratio > 0.2) return '#10b981'; // Cool - green
    return '#60a5fa'; // Cold - blue
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="heatmap-tooltip">
          <p className="tooltip-title">{formatPath(data.path)}</p>
          <div className="tooltip-stats">
            <div className="tooltip-stat">
              <span className="stat-label">Total Views:</span>
              <span className="stat-value">{data.view_count}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const getChartData = () => {
    if (!data?.pageViewCounts) return [];
    return data.pageViewCounts.map(item => ({
      ...item,
      displayName: formatPath(item.path)
    }));
  };

  const maxViews = data?.pageViewCounts?.[0]?.view_count || 1;

  // Check if dark mode is active
  const isDarkMode = document.documentElement.classList.contains('dark-mode');

  // Custom tick component to prevent text wrapping
  const CustomYAxisTick = ({ x, y, payload }) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill={isDarkMode ? '#e5e7eb' : '#334155'}
          fontSize={13}
          fontWeight={500}
          style={{ whiteSpace: 'nowrap' }}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content page-heatmap-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Project Heatmap Report</h2>
            <p className="modal-subtitle">Project view analytics - Which projects are getting the most attention</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="heatmap-controls">
          <label>
            Time Period:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </label>
        </div>

        {loading && (
          <div className="loading-state">Loading heatmap data...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {data && !loading && (
          <div className="heatmap-content">
            {/* Summary Stats */}
            <div className="heatmap-summary">
              <div className="summary-stat">
                <span className="summary-label">Projects Viewed</span>
                <span className="summary-value">{data.pageViewCounts.length}</span>
              </div>
              <div className="summary-stat">
                <span className="summary-label">Total Views</span>
                <span className="summary-value">
                  {data.pageViewCounts.reduce((sum, p) => sum + p.view_count, 0)}
                </span>
              </div>
              <div className="summary-stat">
                <span className="summary-label">Active Users</span>
                <span className="summary-value">
                  {data.topUsers?.length || 0}
                </span>
              </div>
            </div>

            {/* Heatmap Bar Chart */}
            {data.pageViewCounts.length > 0 ? (
              <div className="chart-container">
                <h3>Project Views (Heat Scale)</h3>
                <div className="chart-scroll-wrapper">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(400, getChartData().length * 50)}
                  >
                    <BarChart
                      data={getChartData()}
                      layout="vertical"
                      margin={{ top: 20, right: 80, left: 250, bottom: 5 }}
                      barSize={32}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e2e8f0'} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 13, fill: isDarkMode ? '#e5e7eb' : '#334155' }}
                        label={{ value: 'Number of Views', position: 'insideBottom', offset: -5, style: { fontSize: 13, fontWeight: 600, fill: isDarkMode ? '#e5e7eb' : '#334155' } }}
                      />
                      <YAxis
                        dataKey="displayName"
                        type="category"
                        width={240}
                        tick={<CustomYAxisTick />}
                        interval={0}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="view_count" name="Views" radius={[0, 6, 6, 0]}>
                        {getChartData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getHeatColor(entry.view_count, maxViews)}
                          />
                        ))}
                        <LabelList
                          dataKey="view_count"
                          position="right"
                          style={{ fontSize: 13, fontWeight: 600, fill: isDarkMode ? '#e5e7eb' : '#334155' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="heat-legend">
                  <span style={{ fontSize: '13px', fontWeight: 600, marginRight: '12px' }}>Heat Scale:</span>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#60a5fa' }} />
                    <span>Cold (0-20%)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#10b981' }} />
                    <span>Cool (20-40%)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#fbbf24' }} />
                    <span>Moderate (40-60%)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#f59e0b' }} />
                    <span>Warm (60-80%)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#dc2626' }} />
                    <span>Hot (80-100%)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-data">No project views in this period</div>
            )}

            {/* Top Users */}
            {data.topUsers && data.topUsers.length > 0 && (
              <div className="top-users-section">
                <h3>Most Active Users</h3>
                <div className="top-users-grid">
                  {data.topUsers.slice(0, 5).map((user, index) => (
                    <div key={index} className="user-card">
                      <span className="user-rank">#{index + 1}</span>
                      <span className="user-name">{user.user_name}</span>
                      <span className="user-views">{user.view_count} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeatmapReport;
