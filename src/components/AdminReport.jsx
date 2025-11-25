import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './PortfolioReport.css'; // Reuse existing styles

const AdminReport = ({ type, id, name, onClose, onMetricClick }) => {
  // type can be 'portfolio' or 'space'
  // id is the portfolio_id or space_id
  // name is the display name

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (type === 'all' || id) {
      loadReport();
    } else {
      setError('No report ID provided');
      setLoading(false);
    }
  }, [id, type]);

  const loadReport = async () => {
    try {
      setLoading(true);
      let response;

      if (type === 'portfolio') {
        response = await api.get(`/portfolios/${id}/report`);
      } else if (type === 'space') {
        response = await api.get(`/spaces/${id}/report`);
      } else if (type === 'all') {
        response = await api.get(`/reports/all`);
      } else {
        throw new Error('Invalid report type');
      }

      setReportData(response.data);
      setError(null);
    } catch (err) {
      console.error(`Failed to load ${type} report:`, err);
      const errorMessage = err.response?.data?.error || err.message || `Failed to load ${type} report`;
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
              <div className="project-header-right">
                {project.initiative_manager && (
                  <span className="project-manager">PM: {project.initiative_manager}</span>
                )}
                {(type === 'space' || type === 'all') && project.portfolio_name && (
                  <span className="project-portfolio" style={{
                    backgroundColor: project.portfolio_color || '#6366f1',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {project.portfolio_name}
                  </span>
                )}
              </div>
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
                              <p>{metric.latestComment.comment_text}</p>
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

  const { summary, redProjects, amberProjects, greenProjects } = reportData;
  const entityName = name || (type === 'portfolio' ? 'Portfolio' : type === 'space' ? 'Space' : 'All Spaces');

  return (
    <div className="portfolio-report-modal" onClick={onClose}>
      <div className="report-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-btn" title="Close">×</button>
        <div className="report-header">
          <div>
            <h2>{entityName} - Status Report</h2>
            {reportData.description && <p className="portfolio-description">{reportData.description}</p>}
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
          </div>
        </div>

        {/* Red Projects Section */}
        {renderProjectSection(redProjects, 'Red Projects - Immediate Attention Required', 'red', true)}

        {/* Amber Projects Section */}
        {renderProjectSection(amberProjects, 'Amber Projects - At Risk', 'amber', true)}

        {/* Green Projects Section */}
        {renderProjectSection(greenProjects, 'Green Projects - On Track', 'green', false)}

        {summary.totalProjects === 0 && (
          <div className="no-projects">
            <p>No projects found in this {type}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReport;
