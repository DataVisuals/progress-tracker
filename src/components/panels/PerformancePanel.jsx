import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { MdSpeed, MdWarning } from 'react-icons/md';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../api/client';
import { smallSelectStyles } from '../SelectStyles';

const PerformancePanel = ({
  panelId,
  index,
  darkMode,
  forDock,
  onNavigateToProject,
  projects,
  getDisplayLimit,
  isAdmin,
  databaseStats
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
        <h2>Performance</h2>
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
        {/* Database Stats Section */}
        {isAdmin && databaseStats && !databaseStats.error && (
          <div className="database-stats-content">
            {(() => {
              const sizeGB = databaseStats.totalSizeBytes / 1024 / 1024 / 1024;
              const sizeMB = databaseStats.totalSizeBytes / 1024 / 1024;
              const greenLimit = 100; // GB - optimal performance limit
              const amberLimit = 200 * 1024; // 200 TB in GB
              const maxLimit = 281 * 1024; // 281 TB in GB - SQLite max
              let status, statusColor, percentFill, tooltipText;

              if (sizeGB < greenLimit) {
                status = 'healthy';
                statusColor = '#10b981';
                percentFill = Math.max(1, (sizeGB / greenLimit) * 100);
                tooltipText = `SQLite performs well up to ~100GB. Current: ${sizeMB.toFixed(2)} MB`;
              } else if (sizeGB < amberLimit) {
                status = 'warning';
                statusColor = '#f59e0b';
                percentFill = Math.max(1, Math.min(100, (sizeGB / amberLimit) * 100));
                tooltipText = `Database over 100GB may have performance issues. Max: 281TB`;
              } else {
                status = 'critical';
                statusColor = '#ef4444';
                percentFill = Math.min(100, (sizeGB / maxLimit) * 100);
                tooltipText = `Database approaching SQLite maximum (281TB).`;
              }

              const displaySize = sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
              const tableCount = databaseStats.tables?.length || 0;
              const indexCount = databaseStats.indexes?.length || 0;
              const rightLabel = status === 'healthy' ? '100 GB' : status === 'warning' ? '200 TB' : '281 TB';

              return (
                <div className="db-summary-line" title={tooltipText}>
                  <span className="db-size-value">{displaySize}</span>
                  <div className="db-bar-wrapper">
                    <div className="db-size-bar-inline">
                      <div className={`db-size-fill ${status}`} style={{ width: `${percentFill}%`, backgroundColor: statusColor }} />
                    </div>
                    <div className="db-bar-scale">
                      <span>0</span>
                      <span>{rightLabel}</span>
                    </div>
                  </div>
                  <span className="db-counts">{tableCount} tables / {indexCount} indexes</span>
                </div>
              );
            })()}
            <div className="db-donut-chart">
              {(() => {
                const sortedTables = databaseStats.tables
                  ?.slice()
                  .sort((a, b) => (b.estimatedKB || b.rowCount) - (a.estimatedKB || a.rowCount));
                const colors = ['#00aeef', '#003c71', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

                const indexesByTable = {};
                databaseStats.indexes?.forEach(idx => {
                  if (!indexesByTable[idx.tableName]) {
                    indexesByTable[idx.tableName] = [];
                  }
                  indexesByTable[idx.tableName].push(idx.name);
                });

                const formatSize = (kb) => {
                  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
                  if (kb >= 1) return `${kb.toFixed(1)} KB`;
                  return `${(kb * 1024).toFixed(0)} B`;
                };

                const chartData = sortedTables?.map((t, idx) => ({
                  name: t.name,
                  displayName: t.name.replace(/^(project_|user_|metric_)/, ''),
                  rows: t.rowCount,
                  value: t.estimatedKB || Math.round(t.rowCount * 0.15) || 0.1,
                  fill: colors[idx % colors.length],
                  sizeLabel: formatSize(t.estimatedKB || Math.round(t.rowCount * 0.15)),
                  indexes: indexesByTable[t.name] || []
                })) || [];

                const renderLabel = ({ cx, cy, midAngle, outerRadius, innerRadius, displayName, percent, fill }) => {
                  const RADIAN = Math.PI / 180;
                  const textColor = darkMode ? '#e5e7eb' : '#374151';

                  // Hide labels for tiny slices (less than 3%)
                  if (percent < 0.03) return null;

                  // For large slices (>15%), show label inside the slice
                  if (percent >= 0.15) {
                    const midRadius = (innerRadius + outerRadius) / 2;
                    const x = cx + midRadius * Math.cos(-midAngle * RADIAN);
                    const y = cy + midRadius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#ffffff"
                        fontSize={9}
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        {displayName}
                      </text>
                    );
                  }

                  // For medium slices (3-15%), show label outside with leader line
                  const outerLabelRadius = outerRadius * 1.15;
                  const lineEndRadius = outerRadius * 1.05;
                  const x = cx + outerLabelRadius * Math.cos(-midAngle * RADIAN);
                  const y = cy + outerLabelRadius * Math.sin(-midAngle * RADIAN);
                  const lineStartX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                  const lineStartY = cy + outerRadius * Math.sin(-midAngle * RADIAN);
                  const lineEndX = cx + lineEndRadius * Math.cos(-midAngle * RADIAN);
                  const lineEndY = cy + lineEndRadius * Math.sin(-midAngle * RADIAN);

                  return (
                    <g>
                      <line
                        x1={lineStartX}
                        y1={lineStartY}
                        x2={lineEndX}
                        y2={lineEndY}
                        stroke={fill}
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={y}
                        fill={textColor}
                        fontSize={9}
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                      >
                        {displayName}
                      </text>
                    </g>
                  );
                };

                return (
                  <div className="db-main-content">
                    <div className="db-chart-section">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius="50%"
                            outerRadius="85%"
                            dataKey="value"
                            label={renderLabel}
                            labelLine={false}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const data = payload[0].payload;
                              return (
                                <div className="db-table-tooltip">
                                  <div className="tooltip-title">{data.name}</div>
                                  <div className="tooltip-stats">
                                    <span>{data.sizeLabel}</span>
                                    <span>{data.rows?.toLocaleString()} rows</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="db-tables-section">
                      <div className="db-section-title">Tables</div>
                      <div className="db-data-table">
                        <div className="db-table-header">
                          <span>Name</span>
                          <span>Rows</span>
                          <span>Size</span>
                        </div>
                        {chartData.slice(0, forDock ? 12 : 5).map((table, idx) => (
                          <div key={idx} className="db-table-row">
                            <span className="db-table-name">
                              <span className="db-color-dot" style={{ background: table.fill }} />
                              {table.displayName}
                            </span>
                            <span className="db-table-rows">{table.rows?.toLocaleString()}</span>
                            <span className="db-table-size">{table.sizeLabel}</span>
                          </div>
                        ))}
                      </div>
                      {databaseStats.indexes?.length > 0 && (
                        <>
                          <div className="db-section-title">Indexes</div>
                          <div className="db-data-table db-index-table">
                            <div className="db-table-header">
                              <span>Index</span>
                              <span>Table</span>
                            </div>
                            {databaseStats.indexes.slice(0, forDock ? 10 : 4).map((idx, i) => (
                              <div key={i} className="db-table-row">
                                <span className="db-index-name">{idx.name}</span>
                                <span className="db-index-table-name">{idx.tableName?.replace(/^(project_|user_|metric_)/, '')}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Page Performance Section */}
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
            {performanceData.dailyTrend && performanceData.dailyTrend.length > 0 && (
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
                      dot={true}
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
