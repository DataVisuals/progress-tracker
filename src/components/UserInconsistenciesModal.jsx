import React, { useState } from 'react';
import Lottie from 'lottie-react';
import fixingAnimation from '../assets/fixing-animation.json';
import {
  MdEdit,
  MdLink,
  MdWarning,
  MdArrowForward,
  MdFeedback,
  MdCalendarToday,
  MdShare,
  MdCheck
} from 'react-icons/md';

// Helper function to format timestamps
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const UserInconsistenciesModal = ({
  isOpen,
  onClose,
  inconsistencies,
  feedback,
  upcomingMetrics = []
}) => {
  const [copied, setCopied] = useState(false);

  // Show modal if there are inconsistencies OR upcoming metrics (forward view)
  if (!isOpen || (inconsistencies.length === 0 && upcomingMetrics.length === 0)) return null;

  const hasIssues = inconsistencies.length > 0 || feedback.length > 0;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=inconsistencies`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content user-inconsistencies-modal">
        <div className="modal-header">
          <Lottie
            animationData={fixingAnimation}
            loop={true}
            className="modal-icon-lottie"
          />
          <h2>{hasIssues ? 'Your Projects Need Attention' : 'Coming Up'}</h2>
          <div className="modal-header-actions">
            <button
              className="share-link-btn"
              onClick={handleShare}
              title={copied ? 'Copied!' : 'Copy share link'}
            >
              {copied ? <MdCheck /> : <MdShare />}
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">
          {hasIssues && (
            <p className="inconsistency-intro">
              You have {inconsistencies.length} issue{inconsistencies.length !== 1 ? 's' : ''} that need attention.
              Click on any item to open it in a new tab.
            </p>
          )}
          <div className="user-inconsistency-list">
            {inconsistencies.map((issue, idx) => {
              let issueTitle = '';
              let issueIcon = null;

              if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has no recovery plan`;
                issueIcon = <span className={`metric-rag-marker ${issue.rag_status}`} />;
              } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                issueTitle = `${issue.metric_name} is missing a description`;
                issueIcon = <MdEdit className="issue-icon" />;
              } else if (issue.type === 'missing_project_description') {
                issueTitle = `${issue.project_name} is missing a description`;
                issueIcon = <MdEdit className="issue-icon" />;
              } else if (issue.type === 'missing_documentation') {
                issueTitle = `${issue.project_name} has no documentation links`;
                issueIcon = <MdLink className="issue-icon" />;
              } else {
                issueTitle = issue.details;
                issueIcon = <MdWarning className="issue-icon" />;
              }

              const projectUrl = `${window.location.origin}${window.location.pathname}?project=${issue.project_id}`;

              return (
                <a
                  key={idx}
                  href={projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="user-inconsistency-item"
                >
                  <div className="issue-icon-wrapper">
                    {issueIcon}
                  </div>
                  <div className="issue-details">
                    <div className="issue-title">{issueTitle}</div>
                    <div className="issue-project">
                      {issue.project_name}
                      {issue.first_detected && (
                        <span className="issue-age"> · {formatTimestamp(issue.first_detected)}</span>
                      )}
                    </div>
                  </div>
                  <MdArrowForward className="issue-arrow" />
                </a>
              );
            })}
          </div>

          {/* Unresolved Feedback Section */}
          {feedback.length > 0 && (
            <>
              <div className="feedback-divider" />
              <p className="inconsistency-intro" style={{ marginTop: '16px' }}>
                <MdFeedback style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Unresolved feedback on your projects (mark as resolved to clear):
              </p>
              <div className="user-feedback-list">
                {feedback.map((fb) => {
                  const projectUrl = `${window.location.origin}${window.location.pathname}?project=${fb.project_id}&tab=feedback`;
                  return (
                    <div key={fb.id} className="user-feedback-item">
                      <a
                        href={projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="feedback-link"
                      >
                        <div className="issue-icon-wrapper">
                          <MdFeedback className="issue-icon" />
                        </div>
                        <div className="issue-details">
                          <div className="issue-title">{fb.text}</div>
                          <div className="issue-project">
                            {fb.project_name} - {fb.user_name || 'Anonymous'} - {formatTimestamp(fb.created_at)}
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Coming Up Section - Forward View */}
          {upcomingMetrics.length > 0 && (
            <>
              <div className="feedback-divider" />
              <p className="inconsistency-intro" style={{ marginTop: '16px' }}>
                <MdCalendarToday style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Coming up - metrics needing updates soon:
              </p>
              <div className="upcoming-metrics-list">
                {upcomingMetrics.map((item, idx) => {
                  const projectUrl = `${window.location.origin}${window.location.pathname}?project=${item.projectId}&metric=${encodeURIComponent(item.metricName)}`;
                  return (
                    <a
                      key={idx}
                      href={projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`upcoming-metric-item ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}
                    >
                      <div className="issue-icon-wrapper">
                        <span className={`upcoming-dot ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`} />
                      </div>
                      <div className="issue-details">
                        <div className="issue-title">{item.metricName}</div>
                        <div className="issue-project">{item.projectName}</div>
                      </div>
                      <div className="upcoming-due-info">
                        <span className={`due-label ${item.daysDiff < 0 ? 'overdue' : item.daysDiff <= 3 ? 'soon' : ''}`}>
                          {item.daysDiff < 0
                            ? `${Math.abs(item.daysDiff)} day${Math.abs(item.daysDiff) !== 1 ? 's' : ''} overdue`
                            : item.daysDiff === 0
                              ? 'Due today'
                              : `In ${item.daysDiff} day${item.daysDiff !== 1 ? 's' : ''}`}
                        </span>
                        <span className="due-date">{new Date(item.periodDate).toLocaleDateString()}</span>
                      </div>
                      <MdArrowForward className="issue-arrow" />
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserInconsistenciesModal;
