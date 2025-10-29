import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './ConsistencyReport.css';

const ConsistencyReport = ({ onNavigate }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString();
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getConsistencyReport();
      setReport(response.data);
    } catch (err) {
      console.error('Failed to load consistency report:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity) => {
    const classMap = {
      high: 'severity-high',
      warning: 'severity-warning',
      info: 'severity-info'
    };
    return <span className={`severity-badge ${classMap[severity]}`}>{severity.toUpperCase()}</span>;
  };

  const getTypeLabel = (type) => {
    const labels = {
      vacation_month_growth: 'Vacation Month Growth',
      all_back_loaded: 'Back-Loaded Growth',
      single_metric: 'Single Metric Project'
    };
    return labels[type] || type;
  };

  const handleProjectClick = (projectId) => {
    if (onNavigate) {
      onNavigate(projectId);
    }
  };

  if (loading) {
    return (
      <div className="consistency-report">
        <div className="report-header">
          <h2>Data Consistency Report</h2>
        </div>
        <div className="report-content">
          <div className="loading">Loading report...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="consistency-report">
        <div className="report-header">
          <h2>Data Consistency Report</h2>
        </div>
        <div className="report-content">
          <div className="error">
            <p>Error: {error}</p>
            <button onClick={loadReport} className="retry-btn">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consistency-report">
      <div className="report-header">
        <h2>Data Consistency Report</h2>
        <button onClick={loadReport} className="refresh-btn">Refresh</button>
      </div>

      <div className="report-summary">
        <div className="summary-card">
          <div className="summary-label">Total Issues</div>
          <div className="summary-value">{report.total_issues}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Generated</div>
          <div className="summary-value">{new Date(report.generated_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="report-content">
        {report.total_issues === 0 ? (
          <div className="no-issues">
            <p>No consistency issues detected.</p>
          </div>
        ) : (
          <div className="issues-list">
          {report.issues.map((issue, index) => (
            <div key={index} className="issue-card">
              <div className="issue-header">
                <div className="issue-title">
                  {getSeverityBadge(issue.severity)}
                  <span className="issue-type">{getTypeLabel(issue.type)}</span>
                </div>
              </div>

              <div className="issue-body">
                <div className="issue-project">
                  <strong>Project:</strong>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleProjectClick(issue.project_id);
                    }}
                    className="project-link"
                  >
                    {issue.project_name}
                  </a>
                  {issue.pm_name && <span className="pm-name"> (<strong>Initiative Manager:</strong> {issue.pm_name})</span>}
                </div>

                {issue.metric_name && (
                  <div className="issue-metric">
                    <strong>Metric:</strong> {issue.metric_name}
                  </div>
                )}

                <div className="issue-details">
                  {issue.details}
                </div>

                {issue.type === 'vacation_month_growth' && issue.periods && (
                  <div className="issue-data">
                    <div className="table-wrapper">
                      <table className="periods-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Growth</th>
                            <th>Avg Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issue.periods.map((period, pIdx) => (
                            <tr key={pIdx}>
                              <td>{period.date}</td>
                              <td>{formatNumber(period.growth)}</td>
                              <td>{formatNumber(period.avg_growth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {issue.type === 'all_back_loaded' && issue.metrics && (
                  <div className="issue-data">
                    <div className="table-wrapper">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th>First Half Avg</th>
                            <th>Second Half Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issue.metrics.map((metric, mIdx) => (
                            <tr key={mIdx}>
                              <td>{metric.metric_name}</td>
                              <td>{formatNumber(metric.first_half_avg)}</td>
                              <td>{formatNumber(metric.second_half_avg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default ConsistencyReport;
