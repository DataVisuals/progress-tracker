import React from 'react';
import { MdBuild, MdCheckCircle, MdWarning, MdFeedback, MdCalendarToday, MdArrowForward } from 'react-icons/md';

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const AttentionPanel = ({
  panelId,
  index,
  loading,
  forDock,
  userInconsistencies,
  userProjectFeedback,
  upcomingMetrics,
  onNavigateToProject,
  onMetricClick
}) => {
  return (
    <div key={panelId} className={`home-quadrant attention-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdBuild className="quadrant-icon warning" />
        <h2>My Projects Needing Attention</h2>
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : userInconsistencies.length === 0 && userProjectFeedback.length === 0 && upcomingMetrics.length === 0 ? (
          <div className="empty-state success">
            <MdCheckCircle className="empty-icon" />
            <p>All caught up!</p>
            <span>No issues or upcoming updates</span>
          </div>
        ) : forDock ? (
          // Fullscreen two-column layout
          <div className="attention-columns-container">
            <div className="attention-column split-column">
              <div className="attention-split-section">
                <div className="attention-column-header">
                  <MdWarning className="column-icon" />
                  <h3>Inconsistencies ({userInconsistencies.length})</h3>
                </div>
                <div className="attention-column-list">
                  {userInconsistencies.length === 0 ? (
                    <div className="empty-column-state">
                      <MdCheckCircle className="empty-icon-small" />
                      <span>No inconsistencies</span>
                    </div>
                  ) : (
                    userInconsistencies.map((issue, idx) => {
                      let issueTitle = '';
                      if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                        issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} - no recovery plan`;
                      } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                        issueTitle = `${issue.metric_name} - missing description`;
                      } else if (issue.type === 'missing_project_description') {
                        issueTitle = `Missing project description`;
                      } else if (issue.type === 'missing_documentation') {
                        issueTitle = `No documentation links`;
                      } else {
                        issueTitle = issue.details;
                      }
                      return (
                        <div key={`issue-${idx}`} className="attention-item" onClick={() => onNavigateToProject(issue.project_id)}>
                          <div className="attention-icon-wrapper">
                            {issue.type === 'missing_recovery_plan' ? <span className={`metric-rag-marker ${issue.rag_status}`} /> : <MdWarning className="attention-icon" />}
                          </div>
                          <div className="attention-details">
                            <div className="attention-title">{issueTitle}</div>
                            <div className="attention-project">{issue.project_name}</div>
                          </div>
                          <MdArrowForward className="attention-arrow" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="attention-split-section feedback-section">
                <div className="attention-column-header feedback-header">
                  <MdFeedback className="column-icon feedback" />
                  <h3>Feedback ({userProjectFeedback.length})</h3>
                </div>
                <div className="attention-column-list">
                  {userProjectFeedback.length === 0 ? (
                    <div className="empty-column-state">
                      <MdCheckCircle className="empty-icon-small" />
                      <span>No feedback</span>
                    </div>
                  ) : (
                    userProjectFeedback.map((fb) => (
                      <div key={`fb-${fb.id}`} className="attention-item feedback-item" onClick={() => onNavigateToProject(fb.project_id)}>
                        <div className="attention-icon-wrapper"><MdFeedback className="attention-icon feedback" /></div>
                        <div className="attention-details">
                          <div className="attention-title">{fb.text}</div>
                          <div className="attention-project">{fb.project_name} - {fb.user_name || 'Anonymous'} - {formatTimestamp(fb.created_at)}</div>
                        </div>
                        <MdArrowForward className="attention-arrow" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="attention-column upcoming-column">
              <div className="attention-column-header upcoming">
                <MdCalendarToday className="column-icon" />
                <h3>Upcoming Updates - Next 7 Days ({upcomingMetrics.length})</h3>
              </div>
              <div className="attention-column-list">
                {upcomingMetrics.length === 0 ? (
                  <div className="empty-column-state">
                    <MdCheckCircle className="empty-icon-small" />
                    <span>No updates due in the next 7 days</span>
                  </div>
                ) : (
                  upcomingMetrics.map((item, idx) => (
                    <div
                      key={`upcoming-${idx}`}
                      className={`attention-item compact upcoming-item ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}
                      onClick={() => onMetricClick(item.projectId, item.metricName)}
                    >
                      <div className="attention-icon-wrapper">
                        <span className={`upcoming-dot ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`} />
                      </div>
                      <div className="attention-details">
                        <div className="attention-title">{item.metricName}</div>
                        <div className="attention-project">{item.projectName}</div>
                      </div>
                      <div className="upcoming-due-badge">
                        <span className={`due-label ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}>
                          {item.daysDiff < 0
                            ? `${Math.abs(item.daysDiff)}d overdue`
                            : item.daysDiff === 0
                              ? 'Today'
                              : `In ${item.daysDiff}d`}
                        </span>
                      </div>
                      <MdArrowForward className="attention-arrow" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          // Quadrant single-column layout
          <div className="attention-list">
            {userInconsistencies.map((issue, idx) => {
              let issueTitle = '';
              if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has no recovery plan`;
              } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                issueTitle = `${issue.metric_name} is missing a description`;
              } else if (issue.type === 'missing_project_description') {
                issueTitle = `${issue.project_name} is missing a description`;
              } else if (issue.type === 'missing_documentation') {
                issueTitle = `${issue.project_name} has no documentation links`;
              } else {
                issueTitle = issue.details;
              }
              return (
                <div key={`issue-${idx}`} className="attention-item" onClick={() => onNavigateToProject(issue.project_id)}>
                  <div className="attention-icon-wrapper">
                    {issue.type === 'missing_recovery_plan' ? <span className={`metric-rag-marker ${issue.rag_status}`} /> : <MdWarning className="attention-icon" />}
                  </div>
                  <div className="attention-details">
                    <div className="attention-title">{issueTitle}</div>
                    <div className="attention-project">{issue.project_name}{issue.first_detected && <span className="attention-age"> · {formatTimestamp(issue.first_detected)}</span>}</div>
                  </div>
                  <MdArrowForward className="attention-arrow" />
                </div>
              );
            })}
            {userProjectFeedback.map((fb) => (
              <div key={`fb-${fb.id}`} className="attention-item feedback-item" onClick={() => onNavigateToProject(fb.project_id)}>
                <div className="attention-icon-wrapper"><MdFeedback className="attention-icon feedback" /></div>
                <div className="attention-details">
                  <div className="attention-title">{fb.text}</div>
                  <div className="attention-project">{fb.project_name} - {fb.user_name || 'Anonymous'} - {formatTimestamp(fb.created_at)}</div>
                </div>
                <MdArrowForward className="attention-arrow" />
              </div>
            ))}
            {/* Coming Up section in quadrant view */}
            {upcomingMetrics.length > 0 && (
              <>
                {(userInconsistencies.length > 0 || userProjectFeedback.length > 0) && (
                  <div className="attention-section-divider">
                    <MdCalendarToday className="section-icon" />
                    <span>Coming Up</span>
                  </div>
                )}
                {upcomingMetrics.slice(0, 3).map((item, idx) => (
                  <div
                    key={`upcoming-${idx}`}
                    className={`attention-item upcoming-item ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}
                    onClick={() => onMetricClick(item.projectId, item.metricName)}
                  >
                    <div className="attention-icon-wrapper">
                      <span className={`upcoming-dot ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`} />
                    </div>
                    <div className="attention-details">
                      <div className="attention-title">{item.metricName}</div>
                      <div className="attention-project">{item.projectName}</div>
                    </div>
                    <div className="upcoming-due-badge">
                      <span className={`due-label ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}>
                        {item.daysDiff < 0
                          ? `${Math.abs(item.daysDiff)}d overdue`
                          : item.daysDiff === 0
                            ? 'Today'
                            : `In ${item.daysDiff}d`}
                      </span>
                    </div>
                    <MdArrowForward className="attention-arrow" />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttentionPanel;
