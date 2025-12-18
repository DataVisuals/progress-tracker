import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdFileDownload, MdWarning, MdError, MdFlag } from 'react-icons/md';
import { api } from '../api/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import MetricChart from './MetricChart';
import './ProjectOnePager.css';

const ProjectOnePager = ({ project, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [projectData, setProjectData] = useState([]);
  const [risks, setRisks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [recoveryPlans, setRecoveryPlans] = useState([]);
  const [projectComments, setProjectComments] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (project?.id) {
      loadData();
    }
  }, [project?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [metricsRes, craidsRes, recoveryRes, projectDataRes, commentsRes, milestonesRes] = await Promise.all([
        api.getProjectMetrics(project.id),
        api.getProjectCRAIDs(project.id),
        api.get(`/recovery-plans?project_id=${project.id}`),
        api.getProjectData(project.id),
        api.get(`/projects/${project.id}/comments`),
        api.get(`/milestones?project_id=${project.id}`)
      ]);

      const metricsData = metricsRes.data || [];
      const rawProjectData = projectDataRes.data || [];

      setMetrics(metricsData);
      setProjectData(rawProjectData);
      setProjectComments(commentsRes.data || []);
      setMilestones(milestonesRes.data || []);

      const craids = craidsRes.data || [];
      setRisks(craids.filter(c => c.type === 'risk' && c.status !== 'closed'));
      setIssues(craids.filter(c => c.type === 'issue' && c.status !== 'closed'));
      setRecoveryPlans(recoveryRes.data || []);

    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    setExporting(true);
    try {
      // Temporarily disable dark mode for PDF export
      const wasDarkMode = document.documentElement.classList.contains('dark-mode');
      if (wasDarkMode) {
        document.documentElement.classList.remove('dark-mode');
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const tooltips = document.querySelectorAll('.recharts-tooltip-wrapper, .recharts-default-tooltip, [role="tooltip"]');
      const originalDisplays = [];
      tooltips.forEach((tooltip, idx) => {
        originalDisplays[idx] = tooltip.style.display;
        tooltip.style.display = 'none';
      });

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
        ignoreElements: (element) => {
          return element.classList.contains('recharts-tooltip-wrapper') ||
                 element.classList.contains('recharts-default-tooltip') ||
                 element.getAttribute('role') === 'tooltip';
        }
      });

      // Restore dark mode if it was enabled
      if (wasDarkMode) {
        document.documentElement.classList.add('dark-mode');
      }

      tooltips.forEach((tooltip, idx) => {
        tooltip.style.display = originalDisplays[idx];
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // A4 landscape: 297mm x 210mm
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 5;

      const canvasAspect = canvas.width / canvas.height;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      const pageAspect = availableWidth / availableHeight;

      let imgWidth, imgHeight, offsetX, offsetY;

      if (canvasAspect > pageAspect) {
        imgWidth = availableWidth;
        imgHeight = availableWidth / canvasAspect;
        offsetX = margin;
        offsetY = margin;
      } else {
        imgHeight = availableHeight;
        imgWidth = availableHeight * canvasAspect;
        offsetX = margin + (availableWidth - imgWidth) / 2;
        offsetY = margin;
      }

      pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgWidth, imgHeight);
      pdf.save(`${project.name}-summary.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const getRAGColor = (status) => {
    switch (status) {
      case 'red': return '#D0704d';
      case 'amber': return '#f5ad5b';
      case 'green': return '#539668';
      default: return '#9ca3af';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'blocker': return '#dc2626';
      case 'critical': return '#D0704d';
      case 'significant': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const calculateOverallRAG = () => {
    let hasRed = false;
    let hasAmber = false;

    metrics.forEach(metric => {
      const metricData = projectData.filter(d => d.metric_id === metric.id);
      if (metricData.length === 0) return;

      const latestPeriod = metricData.sort((a, b) =>
        new Date(b.reporting_date) - new Date(a.reporting_date)
      )[0];

      if (latestPeriod && latestPeriod.expected > 0) {
        const variance = latestPeriod.complete - latestPeriod.expected;
        const variancePercent = Math.abs((variance / latestPeriod.expected) * 100);
        const amberTolerance = parseFloat(metric.amber_tolerance) || 5.0;
        const redTolerance = parseFloat(metric.red_tolerance) || 10.0;

        if (variance < 0) {
          if (variancePercent > redTolerance) {
            hasRed = true;
          } else if (variancePercent > amberTolerance) {
            hasAmber = true;
          }
        }
      }
    });

    return hasRed ? 'red' : hasAmber ? 'amber' : 'green';
  };

  if (loading) {
    return (
      <div className="one-pager-modal" onClick={onClose}>
        <div className="one-pager-content loading" onClick={(e) => e.stopPropagation()}>
          <p>Loading project summary...</p>
        </div>
      </div>
    );
  }

  const overallRAG = calculateOverallRAG();
  const activeRecoveryPlans = recoveryPlans.filter(rp => rp.status === 'active');

  return (
    <div className="one-pager-modal" onClick={onClose}>
      <div className="one-pager-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <MdClose />
        </button>
        <button className="export-pdf-btn" onClick={handleExportPDF} disabled={exporting}>
          <MdFileDownload />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>

        <div ref={contentRef} className="one-pager-printable">
          {/* Header with RAG bar and timeline */}
          <div className="one-pager-header">
            <div className="rag-bar" style={{ backgroundColor: getRAGColor(overallRAG) }} />
            <div className="header-content">
              <div className="header-main">
                <h1>{project.name}</h1>
                {project.description && <p className="project-desc">{project.description}</p>}
              </div>
              <div className="header-right">
                {/* Timeline in header */}
                {project.start_date && project.end_date && (
                  <div className="simple-timeline">
                    {(() => {
                      const end = new Date(project.end_date).getTime();
                      const now = new Date().getTime();
                      const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

                      if (daysRemaining < 0) {
                        return <span className="timeline-remaining overdue">{Math.abs(daysRemaining)}d overdue</span>;
                      } else if (daysRemaining === 0) {
                        return <span className="timeline-remaining due-today">Due today</span>;
                      } else if (daysRemaining <= 7) {
                        return <span className="timeline-remaining urgent">{daysRemaining}d left</span>;
                      } else if (daysRemaining <= 30) {
                        return <span className="timeline-remaining">{daysRemaining}d left</span>;
                      } else {
                        const weeksRemaining = Math.ceil(daysRemaining / 7);
                        return <span className="timeline-remaining">{weeksRemaining}w left</span>;
                      }
                    })()}
                    <div className="timeline-track">
                      <div className="timeline-start">
                        <span className="timeline-date">{formatShortDate(project.start_date)}</span>
                        <span className="timeline-label">Start</span>
                      </div>
                      <div className="timeline-line">
                        {(() => {
                          const start = new Date(project.start_date).getTime();
                          const end = new Date(project.end_date).getTime();
                          const now = new Date().getTime();
                          const progress = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
                          return (
                            <>
                              <div className="timeline-progress" style={{ width: `${progress}%` }} />
                              <div className="timeline-today" style={{ left: `${progress}%` }} title="Today" />
                            </>
                          );
                        })()}
                        {milestones.slice(0, 4).map((m, idx) => {
                          const start = new Date(project.start_date).getTime();
                          const end = new Date(project.end_date).getTime();
                          const mDate = new Date(m.target_date).getTime();
                          const pos = Math.max(0, Math.min(100, ((mDate - start) / (end - start)) * 100));
                          return (
                            <div
                              key={m.id || idx}
                              className={`timeline-milestone ${m.status === 'completed' ? 'completed' : ''}`}
                              style={{ left: `${pos}%` }}
                              title={`${m.name}: ${formatShortDate(m.target_date)}`}
                            >
                              <span className="milestone-dot" />
                            </div>
                          );
                        })}
                      </div>
                      <div className="timeline-end">
                        <span className="timeline-date">{formatShortDate(project.end_date)}</span>
                        <span className="timeline-label">End</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="header-meta">
                  {project.initiative_manager && <span className="pm-label">PM: {project.initiative_manager}</span>}
                  <span className="generated-date">{formatDate(new Date())}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Section - 3 columns, 2 rows */}
          <div className="metrics-section">
            <div className="metrics-charts-grid">
              {metrics.filter(m => !m.is_archived).slice(0, 6).map((metric) => {
                const metricData = projectData.filter(d => d.metric_id === metric.id);
                if (metricData.length === 0) return null;

                return (
                  <div key={metric.id} className="metric-chart-wrapper">
                    <MetricChart
                      metricName={metric.name}
                      data={metricData}
                      canEdit={false}
                      canEditData={false}
                      amberTolerance={metric.amber_tolerance || 5.0}
                      redTolerance={metric.red_tolerance || 10.0}
                      compactMode={true}
                      onCommentaryChange={() => {}}
                      onDataChange={() => {}}
                      onToleranceChange={() => {}}
                      onTargetChange={() => {}}
                      onProgressionChange={() => {}}
                      onDescriptionChange={() => {}}
                      onDatesChange={() => {}}
                      timeTravelTimestamp={null}
                      projectId={project.id}
                      onTimeTravelChange={() => {}}
                      onRevert={() => {}}
                      isAdmin={false}
                      currentUser={null}
                    />
                  </div>
                );
              })}
            </div>
            {metrics.filter(m => !m.is_archived).length > 6 && (
              <div className="metrics-note">
                +{metrics.filter(m => !m.is_archived).length - 6} more metrics
              </div>
            )}
          </div>

          {/* Milestones, Risks & Issues Row */}
          {(milestones.length > 0 || risks.length > 0 || issues.length > 0) && (
            <div className="info-row milestones-risks-issues-row">
              {/* Milestones */}
              {milestones.length > 0 && (() => {
                // Find the next milestone due (first incomplete one)
                const sortedMilestones = [...milestones].sort((a, b) =>
                  new Date(a.target_date) - new Date(b.target_date)
                );
                const nextDueMilestone = sortedMilestones.find(m =>
                  m.completed !== 1 && m.status !== 'completed'
                );

                return (
                  <div className="info-block milestones-block">
                    <h3>
                      <MdFlag style={{ color: '#8b5cf6' }} />
                      Milestones ({milestones.length})
                    </h3>
                    <table className="milestones-table">
                      <tbody>
                        {milestones.slice(0, 4).map(milestone => {
                          const isComplete = milestone.completed === 1 || milestone.status === 'completed';
                          const isPast = new Date(milestone.target_date) < new Date();
                          const isAtRisk = !isComplete && isPast;
                          const isNextDue = nextDueMilestone && milestone.id === nextDueMilestone.id;
                          return (
                            <tr key={milestone.id} className={`milestone-row ${isComplete ? 'completed' : ''} ${isAtRisk ? 'at-risk' : ''} ${isNextDue ? 'next-due' : ''}`}>
                              <td className="milestone-status-cell">
                                <span className={`milestone-status ${isComplete ? 'completed' : isAtRisk ? 'at-risk' : 'pending'}`}>
                                  {isComplete ? '✓' : isAtRisk ? '!' : '○'}
                                </span>
                              </td>
                              <td className="milestone-name-cell">
                                {isNextDue && <span className="next-due-badge">NEXT</span>}
                                {milestone.title || milestone.name || 'Unnamed'}
                              </td>
                              <td className="milestone-date-cell">{formatShortDate(milestone.target_date)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {milestones.length > 4 && (
                      <div className="more-items">+{milestones.length - 4} more</div>
                    )}
                  </div>
                );
              })()}

              {/* Risks */}
              {risks.length > 0 && (
                <div className="info-block">
                  <h3>
                    <MdWarning style={{ color: '#f59e0b' }} />
                    Risks ({risks.length})
                  </h3>
                  <div className="info-items">
                    {risks.slice(0, 3).map(risk => (
                      <div key={risk.id} className="info-item" style={{ borderLeftColor: getPriorityColor(risk.priority) }}>
                        <span className="priority-badge" style={{ backgroundColor: getPriorityColor(risk.priority) }}>
                          {risk.priority}
                        </span>
                        <span className="item-title">{risk.title}</span>
                      </div>
                    ))}
                    {risks.length > 3 && <div className="more-items">+{risks.length - 3} more</div>}
                  </div>
                </div>
              )}

              {/* Issues */}
              {issues.length > 0 && (
                <div className="info-block">
                  <h3>
                    <MdError style={{ color: '#ef4444' }} />
                    Issues ({issues.length})
                  </h3>
                  <div className="info-items">
                    {issues.slice(0, 3).map(issue => (
                      <div key={issue.id} className="info-item" style={{ borderLeftColor: getPriorityColor(issue.priority) }}>
                        <span className="priority-badge" style={{ backgroundColor: getPriorityColor(issue.priority) }}>
                          {issue.priority}
                        </span>
                        <span className="item-title">{issue.title}</span>
                      </div>
                    ))}
                    {issues.length > 3 && <div className="more-items">+{issues.length - 3} more</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recovery Plans Row */}
          {activeRecoveryPlans.length > 0 && (
            <div className="recovery-section">
              <div className="section-header">
                <h3>Recovery Plans</h3>
              </div>
              <div className="section-content">
                <div className="recovery-items">
                  {activeRecoveryPlans.slice(0, 2).map(plan => {
                    const metric = metrics.find(m => m.id === plan.metric_id);
                    return (
                      <div key={plan.id} className="recovery-item">
                        <div className="recovery-meta">
                          <span className="recovery-metric">{metric?.name || 'Unknown'}</span>
                          {plan.target_recovery_date && (
                            <span className="recovery-date">Target: {formatShortDate(plan.target_recovery_date)}</span>
                          )}
                        </div>
                        <p className="recovery-text">{stripHtml(plan.plan_text)?.slice(0, 400)}{stripHtml(plan.plan_text)?.length > 400 ? '...' : ''}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Commentary Row */}
          {projectComments.length > 0 && (
            <div className="commentary-section">
              <div className="section-header">
                <h3>Commentary</h3>
              </div>
              <div className="section-content">
                <div className="commentary-item">
                  <div className="commentary-meta">
                    <span>{projectComments[0].creator_name || 'Unknown'}</span>
                    <span>{formatShortDate(projectComments[0].created_at)}</span>
                  </div>
                  <p className="commentary-text">{stripHtml(projectComments[0].comment_text)?.slice(0, 300)}{stripHtml(projectComments[0].comment_text)?.length > 300 ? '...' : ''}</p>
                </div>
              </div>
            </div>
          )}

          {/* No Items */}
          {risks.length === 0 && issues.length === 0 && activeRecoveryPlans.length === 0 && projectComments.length === 0 && (
            <div className="no-items-message">
              <p>No open risks, issues, or recovery plans</p>
            </div>
          )}

          {/* Footer */}
          <div className="one-pager-footer">
            <span>Progress Tracker</span>
            <span>{formatDate(new Date())} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOnePager;
