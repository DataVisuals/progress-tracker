import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './PortfolioReport.css';

const PortfolioReport = ({ portfolioId, onClose, onMetricClick }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (portfolioId) {
      loadReport();
    }
  }, [portfolioId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/portfolios/${portfolioId}/report`);
      setReportData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load portfolio report:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load portfolio report';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatVariance = (variance, variancePercent) => {
    const sign = variance >= 0 ? '+' : '';
    return `${sign}${variance.toFixed(1)} (${sign}${variancePercent.toFixed(1)}%)`;
  };

  const getRAGColor = (status) => {
    switch (status) {
      case 'red': return '#D0704d';
      case 'amber': return '#f5ad5b';
      case 'green': return '#539668';
      default: return '#9ca3af';
    }
  };

  const renderProjectSection = (projects, title, ragStatus, showComments = false) => {
    if (projects.length === 0) return null;

    return (
      <div className="report-section">
        <h3 className="report-section-title" style={{ color: getRAGColor(ragStatus) }}>
          <span className="rag-indicator" style={{ backgroundColor: getRAGColor(ragStatus) }}></span>
          {title}
        </h3>
        {projects.map(project => (
          <div key={project.id} className="report-project">
            <div className="project-header">
              <h4>{project.name}</h4>
              {project.initiative_manager && (
                <span className="project-manager">PM: {project.initiative_manager}</span>
              )}
            </div>
            {project.description && (
              <p className="project-description">{project.description}</p>
            )}
            <div className="project-metrics">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Status</th>
                    <th>Complete</th>
                    <th>Expected</th>
                    <th>Variance</th>
                    <th>As of</th>
                    {showComments && <th>Latest Comment</th>}
                  </tr>
                </thead>
                <tbody>
                  {project.metrics.map(metric => (
                    <tr key={metric.id}>
                      <td className="metric-name">
                        <span
                          className="metric-link"
                          onClick={() => onMetricClick(project.id, metric.name)}
                          title="View this metric"
                        >
                          {metric.name}
                        </span>
                      </td>
                      <td className="metric-status">
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getRAGColor(metric.ragStatus) }}
                        >
                          {metric.ragStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="metric-value">{metric.complete?.toFixed(1) || '0.0'}</td>
                      <td className="metric-value">{metric.expected?.toFixed(1) || '0.0'}</td>
                      <td className={`metric-variance ${metric.variance >= 0 ? 'positive' : 'negative'}`}>
                        {formatVariance(metric.variance, metric.variancePercent)}
                      </td>
                      <td className="metric-date">{formatDate(metric.reporting_date)}</td>
                      {showComments && (
                        <td className="metric-comment">
                          {metric.latestComment ? (
                            <div className="comment-box">
                              <div className="comment-text ql-editor" dangerouslySetInnerHTML={{ __html: metric.latestComment.comment_text }} />
                              <span className="comment-meta">
                                {formatDate(metric.latestComment.created_at)} - {metric.latestComment.created_by}
                              </span>
                            </div>
                          ) : (
                            <span className="no-comment">No comments</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="portfolio-report-modal">
        <div className="report-content loading">
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-report-modal" onClick={onClose}>
        <div className="report-content error" onClick={(e) => e.stopPropagation()}>
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Report</h3>
          <p className="error-message">{error}</p>
          <button onClick={onClose} className="error-close-btn">Close</button>
        </div>
      </div>
    );
  }

  if (!reportData) return null;

  const { portfolio, summary, redProjects, amberProjects, greenProjects, risks = [], issues = [] } = reportData;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#dc2626';
      case 'high': return '#D0704d';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="portfolio-report-modal" onClick={onClose}>
      <div className="report-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-btn" title="Close">×</button>
        <div className="report-header">
          <div>
            <h2>{portfolio.name} - Portfolio Status Report</h2>
            {portfolio.description && <p className="portfolio-description">{portfolio.description}</p>}
          </div>
        </div>

        {/* Summary Section */}
        <div className="report-summary">
          <h3>Summary</h3>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-value">{summary.totalProjects}</div>
              <div className="card-label">Total Projects</div>
            </div>
            <div className="summary-card">
              <div className="card-value">{summary.totalMetrics}</div>
              <div className="card-label">Total Metrics</div>
            </div>
            <div className="summary-card red">
              <div className="card-value">{summary.redCount}</div>
              <div className="card-label">Red Projects</div>
            </div>
            <div className="summary-card amber">
              <div className="card-value">{summary.amberCount}</div>
              <div className="card-label">Amber Projects</div>
            </div>
            <div className="summary-card green">
              <div className="card-value">{summary.greenCount}</div>
              <div className="card-label">Green Projects</div>
            </div>
            {summary.openRisks > 0 && (
              <div className="summary-card risk">
                <div className="card-value">{summary.openRisks}</div>
                <div className="card-label">Open Risks</div>
              </div>
            )}
            {summary.openIssues > 0 && (
              <div className="summary-card issue">
                <div className="card-value">{summary.openIssues}</div>
                <div className="card-label">Open Issues</div>
              </div>
            )}
          </div>
        </div>

        {/* Red Projects Section */}
        {renderProjectSection(redProjects, 'Red Projects - Immediate Attention Required', 'red', true)}

        {/* Amber Projects Section */}
        {renderProjectSection(amberProjects, 'Amber Projects - At Risk', 'amber', true)}

        {/* Green Projects Section */}
        {renderProjectSection(greenProjects, 'Green Projects - On Track', 'green', false)}

        {/* Risks Section */}
        {risks.length > 0 && (
          <div className="report-section risks-section">
            <h3 className="report-section-title" style={{ color: '#f59e0b' }}>
              <span className="rag-indicator" style={{ backgroundColor: '#f59e0b' }}></span>
              Open Risks ({risks.length})
            </h3>
            <div className="risks-list">
              {risks.map(risk => (
                <div key={risk.id} className="risk-item" style={{ borderLeftColor: getPriorityColor(risk.priority) }}>
                  <div className="risk-header">
                    <span className="risk-priority" style={{ backgroundColor: getPriorityColor(risk.priority) }}>
                      {risk.priority}
                    </span>
                    <span className="risk-project">{risk.project_name}</span>
                    <span className="risk-status">{risk.status === 'in_progress' ? 'Mitigating' : 'Open'}</span>
                  </div>
                  <div className="risk-title">{risk.title}</div>
                  {risk.description && (
                    <div className="risk-description">{risk.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issues Section */}
        {issues.length > 0 && (
          <div className="report-section issues-section">
            <h3 className="report-section-title" style={{ color: '#dc2626' }}>
              <span className="rag-indicator" style={{ backgroundColor: '#dc2626' }}></span>
              Open Issues ({issues.length})
            </h3>
            <div className="issues-list">
              {issues.map(issue => (
                <div key={issue.id} className="issue-item" style={{ borderLeftColor: getPriorityColor(issue.priority) }}>
                  <div className="issue-header">
                    <span className="issue-priority" style={{ backgroundColor: getPriorityColor(issue.priority) }}>
                      {issue.priority}
                    </span>
                    <span className="issue-project">{issue.project_name}</span>
                    <span className="issue-status">{issue.status === 'in_progress' ? 'In Progress' : 'Open'}</span>
                  </div>
                  <div className="issue-title">{issue.title}</div>
                  {issue.description && (
                    <div className="issue-description">{issue.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.totalProjects === 0 && (
          <div className="no-projects">
            <p>No projects found in this portfolio.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioReport;
