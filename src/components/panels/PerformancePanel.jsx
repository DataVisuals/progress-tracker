import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { MdSpeed } from 'react-icons/md';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../api/client';
import { smallSelectStyles } from '../SelectStyles';

const PerformancePanel = ({
  panelId,
  index,
  darkMode,
  forDock,
  onNavigateToProject,
  projects,
  getDisplayLimit
}) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(() => {
    const stored = localStorage.getItem('performancePanelDays');
    const parsed = stored ? parseInt(stored, 10) : null;
    return [7, 14, 30, 90].includes(parsed) ? parsed : 30;
  });

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/analytics/performance?days=${days}`);
        setPerformanceData(response.data);
      } catch (err) {
        console.error('Failed to load performance data:', err);
        setPerformanceData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, [days]);

  const formatMs = (ms) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const getSpeedClass = (ms) => {
    if (ms < 500) return 'fast';
    if (ms < 1500) return 'medium';
    return 'slow';
  };

  const handlePageClick = (path) => {
    if (!onNavigateToProject || !projects) return;
    if (path.startsWith('Project: ')) {
      const projectName = path.replace('Project: ', '');
      const projectEntry = Object.entries(projects).find(([id, p]) => p.name === projectName);
      if (projectEntry) {
        onNavigateToProject(parseInt(projectEntry[0]));
      }
    }
  };

  return (
    <div key={panelId} className={`home-quadrant performance-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdSpeed className="quadrant-icon" />
        <h2>Page Performance</h2>
        <Select
          key={`perf-days-${darkMode}`}
          className="portfolio-filter-dropdown"
          styles={smallSelectStyles}
          value={{ value: days, label: `Last ${days} days` }}
          onChange={(option) => {
            setDays(option.value);
            localStorage.setItem('performancePanelDays', option.value.toString());
          }}
          options={[
            { value: 7, label: 'Last 7 days' },
            { value: 14, label: 'Last 14 days' },
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' }
          ]}
          isSearchable={false}
        />
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="empty-state">Loading performance data...</div>
        ) : !performanceData || performanceData.viewsWithTiming === 0 ? (
          <div className="empty-state">
            <p>No performance data yet</p>
            <p className="empty-hint">Page load times will appear as users browse the app</p>
          </div>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="performance-stats">
              <div className={`perf-stat ${getSpeedClass(performanceData.overallStats.avgLoadTime)}`}>
                <span className="perf-value">{formatMs(performanceData.overallStats.avgLoadTime)}</span>
                <span className="perf-label">Avg Load Time</span>
              </div>
              <div className="perf-stat">
                <span className="perf-value">{performanceData.overallStats.viewsWithTiming.toLocaleString()}</span>
                <span className="perf-label">Page Views</span>
              </div>
            </div>

            {/* Trend Chart */}
            {performanceData.dailyTrend && performanceData.dailyTrend.length > 1 && (
              <div className="performance-chart">
                <h4>Load Time Trend</h4>
                <ResponsiveContainer width="100%" height={forDock ? 120 : 80}>
                  <LineChart data={performanceData.dailyTrend}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(ms) => formatMs(ms)}
                      width={45}
                    />
                    <Tooltip
                      formatter={(value) => [formatMs(value), 'Avg Load Time']}
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgLoadTime"
                      stroke="#00aeef"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Slowest Pages */}
            <div className="performance-list">
              <h4>Slowest Pages</h4>
              {performanceData.slowestPages && performanceData.slowestPages.length > 0 ? (
                performanceData.slowestPages.slice(0, forDock ? 20 : getDisplayLimit()).map((page, idx) => (
                  <div
                    key={page.path}
                    className={`perf-row ${page.path.startsWith('Project: ') ? 'clickable' : ''}`}
                    onClick={() => handlePageClick(page.path)}
                  >
                    <span className="perf-rank">{idx + 1}</span>
                    <span className="perf-name" title={page.path}>
                      {page.path.startsWith('Project: ') ? page.path.replace('Project: ', '') : page.path}
                    </span>
                    <span className={`perf-time ${getSpeedClass(page.avgLoadTime)}`}>
                      {formatMs(page.avgLoadTime)}
                    </span>
                    <span className="perf-views">{page.views} views</span>
                  </div>
                ))
              ) : (
                <div className="empty-hint">Need more data (min 3 views per page)</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PerformancePanel;
