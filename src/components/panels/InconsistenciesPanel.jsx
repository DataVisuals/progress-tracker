import React from 'react';
import { MdBugReport, MdCheckCircle, MdPeople } from 'react-icons/md';

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
  return (
    <div key={panelId} className={`home-quadrant inconsistency-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdBugReport className="quadrant-icon warning" />
        <h2>Inconsistencies</h2>
      </div>
      <div className="quadrant-content">
        {!inconsistencies ? (
          <div className="loading-text">Loading...</div>
        ) : inconsistencies.total_inconsistencies === 0 ? (
          <div className="no-inconsistencies">
            <MdCheckCircle style={{ fontSize: '48px', color: '#10b981', marginBottom: '8px' }} />
            <p>No inconsistencies found</p>
            <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              {selectedSpace === 'all' ? 'All projects across all spaces' : `All projects in ${spaces.find(s => s.id === Number(selectedSpace))?.name || 'this space'}`}
            </span>
          </div>
        ) : (
          <div className="inconsistency-list">
            {inconsistencies.summary.map((pmData, pmIdx) => {
              const isExpanded = expandedPMs[pmData.pm_name];
              const displayedIssues = isExpanded ? pmData.issues : pmData.issues.slice(0, 3);
              return (
                <div key={pmIdx} className="inconsistency-pm-item">
                  <div className="inconsistency-pm-header">
                    <div className="pm-name-wrapper"><MdPeople className="pm-icon" /><span className="pm-name">{pmData.pm_name}</span></div>
                    <div className="inconsistency-counts"><span className="total-count">{pmData.total}</span></div>
                  </div>
                  {displayedIssues.map((issue, issueIdx) => {
                    let issueTitle = '';
                    let targetProjectId = issue.project_id;
                    if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                      issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has No Recovery Plan`;
                    } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                      issueTitle = `${issue.metric_name} is Missing a Description`;
                    } else if (issue.type === 'missing_project_description' || issue.details === 'Project missing description') {
                      issueTitle = `${issue.project_name} is Missing a Description`;
                    } else if (issue.type === 'missing_documentation') {
                      issueTitle = `${issue.project_name} has No Documentation Links`;
                    } else {
                      issueTitle = issue.details;
                    }
                    return (
                      <div key={issueIdx} className="inconsistency-detail" onClick={() => onNavigateToProject(targetProjectId)} style={{ cursor: 'pointer' }}>
                        {issue.type === 'missing_recovery_plan' && issue.rag_status && <span className={`metric-rag-marker ${issue.rag_status}`} title={issue.rag_status === 'red' ? 'Behind schedule' : 'At risk'} style={{ marginRight: '8px', flexShrink: 0 }} />}
                        <div className="issue-content">
                          <div className="issue-title">{issueTitle}</div>
                          <div className="issue-subtitle">{issue.project_name}{issue.age_days > 0 && <span className="issue-age"> • {issue.age_days}d old</span>}</div>
                        </div>
                      </div>
                    );
                  })}
                  {pmData.issues.length > 3 && (
                    <div className="more-issues" onClick={(e) => { e.stopPropagation(); setExpandedPMs(prev => ({ ...prev, [pmData.pm_name]: !prev[pmData.pm_name] })); }}>
                      {isExpanded ? 'Show less' : `+${pmData.issues.length - 3} more`}
                    </div>
                  )}
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
