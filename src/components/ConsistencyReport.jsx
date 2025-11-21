import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './ConsistencyReport.css';

const ConsistencyReport = ({ onNavigate }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);

  useEffect(() => {
    loadPortfolios();
  }, []);

  useEffect(() => {
    loadReport();
  }, [selectedPortfolio]);

  const loadPortfolios = async () => {
    try {
      const response = await api.get('/portfolios');
      setPortfolios(response.data);
    } catch (err) {
      console.error('Failed to load portfolios:', err);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString();
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = selectedPortfolio
        ? `/admin/consistency-report?portfolio_id=${selectedPortfolio}`
        : '/admin/consistency-report';
      const response = await api.get(url);
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

  const renderIssueTitle = (issue) => {
    // Render title with appropriate links
    if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleMetricClick(issue.project_id, issue.metric_id);
            }}
            className="issue-title-link"
          >
            {issue.metric_name}
          </a>
          {` is ${issue.rag_status?.toUpperCase()} but has No Recovery Plan`}
        </>
      );
    } else if (issue.type === 'missing_historic_data' && issue.metric_name) {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleMetricClick(issue.project_id, issue.metric_id);
            }}
            className="issue-title-link"
          >
            {issue.metric_name}
          </a>
          {` is Missing ${issue.missing_count} Period(s) of Historic Data`}
        </>
      );
    } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleMetricClick(issue.project_id, issue.metric_id);
            }}
            className="issue-title-link"
          >
            {issue.metric_name}
          </a>
          {' is Missing a Description'}
        </>
      );
    } else if (issue.type === 'missing_project_description' || issue.details === 'Project missing description') {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleProjectClick(issue.project_id);
            }}
            className="issue-title-link"
          >
            {issue.project_name}
          </a>
          {' is Missing a Description'}
        </>
      );
    } else if (issue.type === 'missing_documentation') {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleProjectClick(issue.project_id);
            }}
            className="issue-title-link"
          >
            {issue.project_name}
          </a>
          {' has No Documentation Links'}
        </>
      );
    } else if (issue.type === 'vacation_month_growth') {
      const months = issue.periods?.map(p => {
        const month = new Date(p.date).getMonth() + 1;
        return month === 1 ? 'January (December work)' : 'August (July/August work)';
      }).join(', ') || '';
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleMetricClick(issue.project_id, issue.metric_id);
            }}
            className="issue-title-link"
          >
            {issue.metric_name || issue.project_name}
          </a>
          {` shows Normal Growth During Vacation Months: ${months}`}
        </>
      );
    } else if (issue.type === 'all_back_loaded') {
      return (
        <>
          {'All Metrics in '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleProjectClick(issue.project_id);
            }}
            className="issue-title-link"
          >
            {issue.project_name}
          </a>
          {' are Back-Loaded'}
        </>
      );
    } else if (issue.type === 'single_metric') {
      return (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleProjectClick(issue.project_id);
            }}
            className="issue-title-link"
          >
            {issue.project_name}
          </a>
          {' has Only One Metric'}
        </>
      );
    }
    // Fallback to details if no specific formatting
    return issue.details;
  };

  const handleProjectClick = (projectId) => {
    if (onNavigate) {
      onNavigate(projectId);
    }
  };

  const handleMetricClick = (projectId, metricId) => {
    if (onNavigate) {
      // Navigate to project, which will show the metric
      onNavigate(projectId);
    }
  };

  const renderHeader = () => (
    <div className="report-header">
      <h2>Data Consistency Report</h2>
      <div className="report-controls">
        <select
          value={selectedPortfolio || ''}
          onChange={(e) => setSelectedPortfolio(e.target.value || null)}
          className="portfolio-filter"
        >
          <option value="">All Portfolios</option>
          {portfolios.map(portfolio => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
            </option>
          ))}
        </select>
        <button onClick={loadReport} className="refresh-btn">Refresh</button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="consistency-report">
        {renderHeader()}
        <div className="report-content">
          <div className="loading">Loading report...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="consistency-report">
        {renderHeader()}
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
      {renderHeader()}

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
                <div className="issue-details-primary">
                  {renderIssueTitle(issue)}
                </div>
                <div className="issue-project-secondary">
                  {/* Show project link if it's not already in the title */}
                  {!['missing_project_description', 'missing_documentation', 'all_back_loaded', 'single_metric'].includes(issue.type) && (
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
                  )}
                  {issue.pm_name && <span className="pm-name">{!['missing_project_description', 'missing_documentation', 'all_back_loaded', 'single_metric'].includes(issue.type) ? ' • ' : ''}{issue.pm_name}</span>}
                </div>
              </div>

              <div className="issue-body">
                {issue.type === 'missing_historic_data' && issue.first_gap && issue.last_gap && (
                  <div className="issue-detail-text">
                    Missing data between <strong>{issue.first_gap}</strong> and <strong>{issue.last_gap}</strong>
                  </div>
                )}

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
