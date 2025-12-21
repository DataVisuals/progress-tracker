import React, { useState, useMemo } from 'react';
import { MdCheckCircle, MdShare, MdCheck, MdAccessTime, MdWarning, MdError } from 'react-icons/md';
import { FaSkullCrossbones, FaFire } from 'react-icons/fa';

// Get age RAG status, icon, and description
const getAgeInfo = (ageDays) => {
  if (ageDays <= 3) {
    return { status: 'green', label: 'New', icon: MdAccessTime };
  } else if (ageDays <= 7) {
    return { status: 'amber', label: 'Stale', icon: MdWarning };
  } else if (ageDays <= 14) {
    return { status: 'red', label: 'Overdue', icon: MdError };
  } else if (ageDays <= 30) {
    return { status: 'red', label: 'Critical', icon: FaFire };
  } else {
    return { status: 'red', label: 'Severe', icon: FaFire };
  }
};

const InconsistenciesPanel = ({
  panelId,
  index,
  inconsistencies,
  expandedPMs,
  setExpandedPMs,
  selectedSpace,
  spaces,
  onNavigateToProject
}) => {
  const [copied, setCopied] = useState(false);

  // Flatten all issues and sort by age (oldest first)
  const sortedIssues = useMemo(() => {
    if (!inconsistencies?.summary) return [];

    const allIssues = [];
    inconsistencies.summary.forEach(pmData => {
      pmData.issues.forEach(issue => {
        allIssues.push({
          ...issue,
          pm_name: pmData.pm_name
        });
      });
    });

    // Sort by age descending (oldest first)
    return allIssues.sort((a, b) => (b.age_days || 0) - (a.age_days || 0));
  }, [inconsistencies]);

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'inconsistencies');
    const shareUrl = url.toString();
    window.history.replaceState({}, '', shareUrl);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getIssueTitle = (issue) => {
    if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
      return <>{issue.metric_name} <strong>needs a recovery plan</strong></>;
    } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
      return <>{issue.metric_name} <strong>needs a metric description</strong></>;
    } else if (issue.type === 'missing_project_description' || issue.details === 'Project missing description') {
      return <>{issue.project_name} <strong>needs a project description</strong></>;
    } else if (issue.type === 'missing_documentation') {
      return <>{issue.project_name} <strong>needs documentation links</strong></>;
    } else if (issue.type === 'unresolved_feedback') {
      return <>{issue.project_name} <strong>has unresolved feedback</strong></>;
    }
    return issue.details;
  };

  return (
    <div key={panelId} className={`home-quadrant inconsistency-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <FaSkullCrossbones className="quadrant-icon" />
        <h2>Inconsistencies</h2>
        {sortedIssues.length > 0 && (
          <span className="inconsistency-total-badge">{sortedIssues.length}</span>
        )}
        <button
          className="share-link-btn"
          onClick={handleShare}
          title={copied ? 'Copied!' : 'Copy share link'}
        >
          {copied ? <MdCheck /> : <MdShare />}
        </button>
      </div>
      <div className="quadrant-content">
        {!inconsistencies ? (
          <div className="loading-text">Loading...</div>
        ) : sortedIssues.length === 0 ? (
          <div className="no-inconsistencies">
            <MdCheckCircle style={{ fontSize: '48px', color: '#10b981', marginBottom: '8px' }} />
            <p>No inconsistencies found</p>
            <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              {selectedSpace === 'all' ? 'All projects across all spaces' : `All projects in ${spaces.find(s => s.id === Number(selectedSpace))?.name || 'this space'}`}
            </span>
          </div>
        ) : (
          <div className="inconsistency-list-flat">
            {sortedIssues.map((issue, idx) => {
              const ageInfo = getAgeInfo(issue.age_days || 0);
              const AgeIcon = ageInfo.icon;
              return (
                <div
                  key={idx}
                  className="inconsistency-item"
                  onClick={() => onNavigateToProject(issue.project_id)}
                >
                  <div className={`age-indicator age-${ageInfo.status}`}>
                    <AgeIcon className="age-icon" />
                    <span className="age-days">{issue.age_days || 0}d</span>
                    <span className="age-label">{ageInfo.label}</span>
                  </div>
                  <div className="issue-main">
                    <div className="issue-title-row">
                      {issue.type === 'missing_recovery_plan' && issue.rag_status && (
                        <span className={`metric-rag-marker ${issue.rag_status}`} />
                      )}
                      <span className="issue-title">{getIssueTitle(issue)}</span>
                    </div>
                    <div className="issue-meta">
                      <span className="issue-project">{issue.project_name}</span>
                    </div>
                  </div>
                  <div className="issue-owner-column">
                    <span className="issue-owner-name">{issue.pm_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InconsistenciesPanel;
