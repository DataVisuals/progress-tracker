import React from 'react';
import { FaDatabase } from 'react-icons/fa';
import { MdWarning } from 'react-icons/md';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const DatabasePanel = ({
  panelId,
  index,
  isAdmin,
  databaseStats,
  darkMode,
  forDock
}) => {
  if (!isAdmin) return null;

  return (
    <div key={panelId} className={`home-quadrant database-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <FaDatabase className="quadrant-icon" />
        <h2>Database Stats</h2>
      </div>
      <div className="quadrant-content">
        {!databaseStats ? (
          <div className="loading-state">Loading...</div>
        ) : databaseStats.error ? (
          <div className="empty-state">
            <MdWarning className="empty-icon" />
            <p>Unable to load database stats</p>
            <span>{databaseStats.error}</span>
          </div>
        ) : (
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
      </div>
    </div>
  );
};

export default DatabasePanel;
