import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MdClose, MdArrowBack, MdArrowForward, MdFileDownload, MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../api/client';
import { calculateHealthScores } from './ProjectHealthModal';
import { calculateClarityScore } from '../utils/clarityScore';
import MetricChart from './MetricChart';
import ProjectTimelineBar from './ProjectTimelineBar';
import './PortfolioReviewModal.css';

const getHealthColor = (score) => {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const PortfolioReviewModal = ({
  portfolioId,
  portfolioName,
  projects,
  portfolios,
  onClose,
  darkMode = false
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [portfolioProjects, setPortfolioProjects] = useState([]);
  const [projectsData, setProjectsData] = useState({});
  const [projectsMetrics, setProjectsMetrics] = useState({});
  const [projectsLinks, setProjectsLinks] = useState({});
  const [projectsRecoveryPlans, setProjectsRecoveryPlans] = useState({});
  const [projectsMilestones, setProjectsMilestones] = useState({});
  const [projectsComments, setProjectsComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const slideRef = useRef(null);

  // Filter projects for this portfolio
  useEffect(() => {
    if (portfolioId && projects) {
      const filtered = projects.filter(p => p.portfolio_id === portfolioId);
      setPortfolioProjects(filtered);
    }
  }, [portfolioId, projects]);

  // Fetch data for all projects in the portfolio
  useEffect(() => {
    const fetchAllProjectData = async () => {
      if (portfolioProjects.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = {};
      const metrics = {};
      const links = {};
      const recoveryPlans = {};
      const milestones = {};
      const comments = {};

      for (const project of portfolioProjects) {
        try {
          // Fetch project data
          const dataResponse = await api.get(`/projects/${project.id}/data`);
          data[project.id] = dataResponse.data;

          // Fetch project metrics
          const metricsResponse = await api.get(`/projects/${project.id}/metrics`);
          metrics[project.id] = metricsResponse.data;

          // Fetch project links
          const linksResponse = await api.get(`/projects/${project.id}/links`);
          links[project.id] = linksResponse.data;

          // Fetch recovery plans
          const plansResponse = await api.get(`/recovery-plans?project_id=${project.id}`);
          recoveryPlans[project.id] = plansResponse.data;

          // Fetch milestones
          const milestonesResponse = await api.get(`/milestones?project_id=${project.id}`);
          milestones[project.id] = milestonesResponse.data;
          console.log(`Fetched ${milestonesResponse.data.length} milestones for project ${project.id}:`, milestonesResponse.data);

          // Fetch project comments
          const commentsResponse = await api.get(`/projects/${project.id}/comments`);
          comments[project.id] = commentsResponse.data;
        } catch (err) {
          console.error(`Error fetching data for project ${project.id}:`, err);
        }
      }

      setProjectsData(data);
      setProjectsMetrics(metrics);
      setProjectsLinks(links);
      setProjectsRecoveryPlans(recoveryPlans);
      setProjectsMilestones(milestones);
      setProjectsComments(comments);
      setLoading(false);
    };

    fetchAllProjectData();
  }, [portfolioProjects]);

  // Calculate portfolio summary statistics
  const portfolioSummary = React.useMemo(() => {
    if (portfolioProjects.length === 0) return null;

    const stats = {
      totalProjects: portfolioProjects.length,
      healthyProjects: 0,
      atRiskProjects: 0,
      criticalProjects: 0,
      metricsNeedingAttention: [],
      overallHealth: 0,
      healthBreakdown: {
        projectDescribed: 0,
        metricsDescribed: 0,
        metricCoverage: 0,
        metricManagement: 0,
        projectControl: 0,
        contentClarity: 0
      },
      projectHealthScores: []
    };

    let totalHealth = 0;
    let totalProjectDescribed = 0;
    let totalMetricsDescribed = 0;
    let totalMetricCoverage = 0;
    let totalMetricManagement = 0;
    let totalProjectControl = 0;
    let totalContentClarity = 0;

    portfolioProjects.forEach(project => {
      const projectData = projectsData[project.id] || [];
      const projectMetrics = projectsMetrics[project.id] || [];
      const projectLinks = projectsLinks[project.id] || [];
      const projectRecoveryPlans = projectsRecoveryPlans[project.id] || [];

      const healthScores = calculateHealthScores(
        project,
        projectData,
        projectMetrics,
        projectRecoveryPlans,
        projectLinks
      );

      totalHealth += healthScores.overall;
      totalProjectDescribed += healthScores.projectDescribed || 0;
      totalMetricsDescribed += healthScores.metricsDescribed || 0;
      totalMetricCoverage += healthScores.metricCoverage || 0;
      totalMetricManagement += healthScores.metricManagement || 0;
      totalProjectControl += healthScores.projectControl || 0;
      totalContentClarity += healthScores.contentClarity || 0;

      stats.projectHealthScores.push({
        projectId: project.id,
        projectName: project.name,
        score: healthScores.overall
      });

      if (healthScores.overall >= 75) {
        stats.healthyProjects++;
      } else if (healthScores.overall >= 50) {
        stats.atRiskProjects++;
      } else {
        stats.criticalProjects++;
      }

      // Find metrics needing attention (variance issues)
      projectMetrics.forEach(metric => {
        const metricData = projectData.filter(d => d.metric_id === metric.id);
        if (metricData.length > 0) {
          const latest = metricData[metricData.length - 1];
          const complete = parseFloat(latest.complete) || 0;
          const expected = parseFloat(latest.expected) || 0;
          const variance = complete - expected;
          const variancePercent = expected !== 0 ? Math.abs((variance / expected) * 100) : 0;
          const redTolerance = parseFloat(latest.red_tolerance) || 10.0;

          if (variance < 0 && variancePercent > redTolerance) {
            stats.metricsNeedingAttention.push({
              projectName: project.name,
              metricName: metric.name,
              variancePercent: variancePercent.toFixed(1)
            });
          }
        }
      });
    });

    const projectCount = portfolioProjects.length;
    stats.overallHealth = projectCount > 0 ? Math.round(totalHealth / projectCount) : 0;

    // Calculate average health breakdown scores
    if (projectCount > 0) {
      stats.healthBreakdown.projectDescribed = Math.round(totalProjectDescribed / projectCount);
      stats.healthBreakdown.metricsDescribed = Math.round(totalMetricsDescribed / projectCount);
      stats.healthBreakdown.metricCoverage = Math.round(totalMetricCoverage / projectCount);
      stats.healthBreakdown.metricManagement = Math.round(totalMetricManagement / projectCount);
      stats.healthBreakdown.projectControl = Math.round(totalProjectControl / projectCount);
      stats.healthBreakdown.contentClarity = Math.round(totalContentClarity / projectCount);
    }

    return stats;
  }, [portfolioProjects, projectsData, projectsMetrics, projectsLinks, projectsRecoveryPlans]);

  // Create slides: summary + one per project
  const totalSlides = 1 + portfolioProjects.length;

  const handlePrevSlide = useCallback(() => {
    setCurrentSlide(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextSlide = useCallback(() => {
    setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevSlide();
      } else if (e.key === 'ArrowRight') {
        handleNextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevSlide, handleNextSlide]);

  const handleExportToPDF = async () => {
    try {
      if (!slideRef.current) return;

      // Show loading indicator
      setIsExporting(true);

      // Create PDF in landscape mode (11.69 x 8.27 inches = A4 landscape)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: 'a4'
      });

      const totalSlides = portfolioProjects.length + 1; // +1 for summary slide
      const originalSlide = currentSlide;

      // Capture each slide
      for (let i = 0; i < totalSlides; i++) {
        // Navigate to slide
        setCurrentSlide(i);

        // Wait for slide to render
        await new Promise(resolve => setTimeout(resolve, 500));

        // Hide all tooltips and popovers before capturing
        const tooltips = document.querySelectorAll('.recharts-tooltip-wrapper, .recharts-default-tooltip, [role="tooltip"]');
        const originalDisplays = [];
        tooltips.forEach((tooltip, idx) => {
          originalDisplays[idx] = tooltip.style.display;
          tooltip.style.display = 'none';
        });

        // Capture the slide
        const canvas = await html2canvas(slideRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: darkMode ? '#111827' : '#ffffff',
          width: slideRef.current.scrollWidth,
          height: slideRef.current.scrollHeight,
          ignoreElements: (element) => {
            // Ignore tooltips, popovers, and other overlay elements
            return element.classList.contains('recharts-tooltip-wrapper') ||
                   element.classList.contains('recharts-default-tooltip') ||
                   element.getAttribute('role') === 'tooltip';
          }
        });

        // Restore tooltip visibility
        tooltips.forEach((tooltip, idx) => {
          tooltip.style.display = originalDisplays[idx];
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 11.69; // A4 landscape width in inches
        const imgHeight = 8.27; // A4 landscape height in inches

        // Add page (not for first page, it's added automatically)
        if (i > 0) {
          pdf.addPage();
        }

        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      // Save PDF
      pdf.save(`${portfolioName}-Portfolio-Review.pdf`);

      // Restore original slide
      setCurrentSlide(originalSlide);

      // Reset button
      setIsExporting(false);
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      alert('Failed to export to PDF. Please try again.');

      // Reset button on error
      setIsExporting(false);
    }
  };

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!portfolioSummary) return [];
    return [
      { dimension: 'Project\nDescribed', score: portfolioSummary.healthBreakdown.projectDescribed },
      { dimension: 'Metrics\nDescribed', score: portfolioSummary.healthBreakdown.metricsDescribed },
      { dimension: 'Metric\nCoverage', score: portfolioSummary.healthBreakdown.metricCoverage },
      { dimension: 'Metric\nManagement', score: portfolioSummary.healthBreakdown.metricManagement },
      { dimension: 'Project\nControl', score: portfolioSummary.healthBreakdown.projectControl },
      { dimension: 'Content\nClarity', score: portfolioSummary.healthBreakdown.contentClarity }
    ];
  }, [portfolioSummary]);

  // Calculate timeline range for horizontal timeline
  const timelineData = useMemo(() => {
    if (!portfolioProjects || portfolioProjects.length === 0) return null;

    const projectsWithDates = portfolioProjects
      .filter(p => p.end_date)
      .map(p => ({
        ...p,
        endDate: new Date(p.end_date),
        startDate: p.start_date ? new Date(p.start_date) : null
      }))
      .sort((a, b) => a.endDate - b.endDate);

    if (projectsWithDates.length === 0) return null;

    const now = new Date();

    // Collect all milestone dates to determine the full timeline range
    const milestoneDates = [];
    portfolioProjects.forEach(project => {
      const milestones = projectsMilestones[project.id] || [];
      milestones.forEach(m => {
        if (m.target_date) {
          milestoneDates.push(new Date(m.target_date));
        }
      });
    });

    // Calculate min/max considering project dates AND milestone dates
    const allDates = [
      now,
      ...projectsWithDates.map(p => p.startDate).filter(d => d !== null),
      ...projectsWithDates.map(p => p.endDate).filter(d => d !== null),
      ...milestoneDates
    ];

    const validDates = allDates.filter(d => d instanceof Date && !isNaN(d));
    if (validDates.length === 0) return null;

    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));

    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);

    return {
      projects: projectsWithDates,
      range: { min: minDate, max: maxDate, now }
    };
  }, [portfolioProjects, projectsMilestones]);

  const getTimelinePosition = (date) => {
    if (!timelineData?.range) return 0;
    const { min, max } = timelineData.range;
    const totalMs = max.getTime() - min.getTime();
    const dateMs = date.getTime() - min.getTime();
    return Math.max(0, Math.min(100, (dateMs / totalMs) * 100));
  };

  const getTimeMarkers = () => {
    if (!timelineData?.range) return [];
    const { min, max } = timelineData.range;
    const markers = [];
    const current = new Date(min);
    current.setDate(1);

    while (current <= max) {
      const position = getTimelinePosition(current);
      if (position >= 5 && position <= 97) {
        markers.push({
          date: new Date(current),
          position,
          label: current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        });
      }
      current.setMonth(current.getMonth() + 1);
    }
    return markers;
  };

  // Generate suggested actions based on portfolio health
  const getSuggestedActions = () => {
    if (!portfolioSummary) return [];

    const actions = [];
    const healthBreakdown = portfolioSummary.healthBreakdown;

    // Check for critical/at-risk projects
    if (portfolioSummary.criticalProjects > 0) {
      const criticalProjects = portfolioProjects
        .filter(p => {
          const health = calculateHealthScores(p, projectsData[p.id] || [], projectsMetrics[p.id] || [], projectsLinks[p.id] || []);
          return health.overallScore < 50;
        })
        .slice(0, 3);

      const projectList = criticalProjects.map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');

      actions.push({
        priority: 'high',
        action: `need to be reviewed`,
        details: projectList,
        reason: 'Health scores below 50%'
      });
    }

    if (portfolioSummary.atRiskProjects > 0) {
      const atRiskProjects = portfolioProjects
        .filter(p => {
          const health = calculateHealthScores(p, projectsData[p.id] || [], projectsMetrics[p.id] || [], projectsLinks[p.id] || []);
          return health.overallScore >= 50 && health.overallScore < 75;
        })
        .slice(0, 3);

      const projectList = atRiskProjects.map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');

      actions.push({
        priority: 'medium',
        action: `need to be monitored`,
        details: projectList,
        reason: 'Health scores 50-75%'
      });
    }

    // Check health breakdown dimensions
    if (healthBreakdown.projectDescribed < 60) {
      const projectsNeedingDesc = portfolioProjects.filter(p => !p.description);
      if (projectsNeedingDesc.length > 0) {
        const projectList = projectsNeedingDesc.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'high',
          action: 'need to add project descriptions',
          details: projectList + (projectsNeedingDesc.length > 3 ? ` +${projectsNeedingDesc.length - 3} more` : ''),
          reason: `${projectsNeedingDesc.length} project${projectsNeedingDesc.length > 1 ? 's' : ''} missing descriptions`
        });
      }
    }

    if (healthBreakdown.metricsDescribed < 60) {
      const projectsWithUndescribedMetrics = portfolioProjects.filter(p => {
        const metrics = projectsMetrics[p.id] || [];
        return metrics.some(m => !m.description);
      });
      if (projectsWithUndescribedMetrics.length > 0) {
        const projectList = projectsWithUndescribedMetrics.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'high',
          action: 'need to add metric descriptions',
          details: projectList + (projectsWithUndescribedMetrics.length > 3 ? ` +${projectsWithUndescribedMetrics.length - 3} more` : ''),
          reason: `${projectsWithUndescribedMetrics.length} project${projectsWithUndescribedMetrics.length > 1 ? 's have' : ' has'} metrics without descriptions`
        });
      }
    }

    if (healthBreakdown.metricCoverage < 60) {
      const projectsWithLowCoverage = portfolioProjects.filter(p => {
        const metrics = projectsMetrics[p.id] || [];
        const data = projectsData[p.id] || [];
        if (metrics.length === 0) return false;
        const coverageScore = (data.filter(d => d.actual !== null).length / (metrics.length * 12)) * 100;
        return coverageScore < 60;
      });
      if (projectsWithLowCoverage.length > 0) {
        const projectList = projectsWithLowCoverage.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'medium',
          action: 'need to increase metric data collection',
          details: projectList + (projectsWithLowCoverage.length > 3 ? ` +${projectsWithLowCoverage.length - 3} more` : ''),
          reason: `${projectsWithLowCoverage.length} project${projectsWithLowCoverage.length > 1 ? 's have' : ' has'} low data coverage`
        });
      }
    }

    if (healthBreakdown.metricManagement < 60) {
      const projectsWithVariance = portfolioProjects.filter(p => {
        const data = projectsData[p.id] || [];
        return data.some(d => {
          if (d.actual === null || d.expected === null) return false;
          const variance = Math.abs((d.actual - d.expected) / d.expected) * 100;
          return variance > 10;
        });
      });
      if (projectsWithVariance.length > 0) {
        const projectList = projectsWithVariance.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'high',
          action: 'need to address underperforming metrics',
          details: projectList + (projectsWithVariance.length > 3 ? ` +${projectsWithVariance.length - 3} more` : ''),
          reason: `${projectsWithVariance.length} project${projectsWithVariance.length > 1 ? 's have' : ' has'} metrics with significant variance`
        });
      }
    }

    if (healthBreakdown.projectControl < 60) {
      const projectsNeedingDates = portfolioProjects.filter(p => !p.start_date || !p.end_date);
      if (projectsNeedingDates.length > 0) {
        const projectList = projectsNeedingDates.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'medium',
          action: 'need to set project start/end dates',
          details: projectList + (projectsNeedingDates.length > 3 ? ` +${projectsNeedingDates.length - 3} more` : ''),
          reason: `${projectsNeedingDates.length} project${projectsNeedingDates.length > 1 ? 's' : ''} missing timelines`
        });
      }
    }

    if (healthBreakdown.contentClarity < 60) {
      const projectsWithLowClarity = portfolioProjects.filter(p => {
        const projectClarity = p.description ? calculateClarityScore(p.description) : 0;
        return projectClarity < 60;
      });
      if (projectsWithLowClarity.length > 0) {
        const projectList = projectsWithLowClarity.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'medium',
          action: 'need to improve description clarity',
          details: projectList + (projectsWithLowClarity.length > 3 ? ` +${projectsWithLowClarity.length - 3} more` : ''),
          reason: `${projectsWithLowClarity.length} project${projectsWithLowClarity.length > 1 ? 's have' : ' has'} low readability scores`
        });
      }
    }

    // Check metrics needing attention
    if (portfolioSummary.metricsNeedingAttention.length > 0) {
      // Group by project
      const metricsByProject = {};
      portfolioSummary.metricsNeedingAttention.forEach(metric => {
        if (!metricsByProject[metric.projectId]) {
          metricsByProject[metric.projectId] = [];
        }
        metricsByProject[metric.projectId].push(metric.metricName);
      });

      const projectList = Object.keys(metricsByProject).slice(0, 3).map(projectId => {
        const project = portfolioProjects.find(p => p.id === parseInt(projectId));
        if (!project) return null;
        return `${project.name} (PM: ${project.initiative_manager || 'Unassigned'})`;
      }).filter(Boolean).join(', ');

      if (projectList) {
        actions.push({
          priority: 'high',
          action: 'need to address underperforming metrics',
          details: projectList + (Object.keys(metricsByProject).length > 3 ? ` +${Object.keys(metricsByProject).length - 3} more` : ''),
          reason: `${portfolioSummary.metricsNeedingAttention.length} metric${portfolioSummary.metricsNeedingAttention.length > 1 ? 's' : ''} beyond tolerance thresholds`
        });
      }
    }

    // Check timeline issues
    if (timelineData) {
      const overdueProjects = timelineData.projects.filter(p => {
        const daysRemaining = Math.ceil((p.endDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysRemaining < 0;
      });

      if (overdueProjects.length > 0) {
        const projectList = overdueProjects.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'high',
          action: `need to be reviewed`,
          details: projectList + (overdueProjects.length > 3 ? ` +${overdueProjects.length - 3} more` : ''),
          reason: 'Projects past their end dates need immediate review'
        });
      }

      const urgentProjects = timelineData.projects.filter(p => {
        const daysRemaining = Math.ceil((p.endDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysRemaining >= 0 && daysRemaining <= 14;
      });

      if (urgentProjects.length > 0) {
        const projectList = urgentProjects.slice(0, 3).map(p => `${p.name} (PM: ${p.initiative_manager || 'Unassigned'})`).join(', ');
        actions.push({
          priority: 'medium',
          action: `need focused attention`,
          details: projectList + (urgentProjects.length > 3 ? ` +${urgentProjects.length - 3} more` : ''),
          reason: 'Due within 2 weeks - ensure resources are allocated'
        });
      }
    }

    // If portfolio health is good, provide maintenance actions
    if (portfolioSummary.overallHealth >= 80 && actions.length === 0) {
      actions.push({
        priority: 'low',
        action: 'Maintain current project management practices',
        reason: 'Portfolio health is excellent - continue regular monitoring'
      });
      actions.push({
        priority: 'low',
        action: 'Consider establishing best practices documentation',
        reason: 'Share successful approaches across the portfolio'
      });
    }

    // Sort by priority and limit to top 5
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
  };

  const renderSummarySlide = () => {
    if (!portfolioSummary) return null;

    const timeMarkers = getTimeMarkers();
    const nowPosition = timelineData?.range ? getTimelinePosition(timelineData.range.now) : 0;
    const suggestedActions = getSuggestedActions();

    return (
      <div className="portfolio-review-slide summary-slide">
        <div className="summary-header" style={{ borderBottom: 'none' }}>
          <h2>{portfolioName} - Portfolio Review</h2>
        </div>

        <div className="summary-content-compact">
          {/* Top Row: Health Radar + Status Cards */}
          <div className="summary-top-row">
            <div className="health-radar-section">
              <h3>Portfolio Health: {portfolioSummary.overallHealth}%</h3>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 25, right: 35, bottom: 25, left: 35 }}>
                  <PolarGrid stroke="#d1d5db" strokeWidth={1} />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickLine={false}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} stroke="#e5e7eb" />
                  <Radar
                    name="Health Score"
                    dataKey="score"
                    stroke="#00aeef"
                    strokeWidth={2}
                    fill="#00aeef"
                    fillOpacity={0.5}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="status-metrics-section">
              <div className="status-cards-compact">
                <div className="status-card-compact healthy">
                  <MdCheckCircle />
                  <div className="status-info">
                    <div className="status-count">{portfolioSummary.healthyProjects}</div>
                    <div className="status-label">Healthy Projects</div>
                  </div>
                </div>
                <div className="status-card-compact at-risk">
                  <MdWarning />
                  <div className="status-info">
                    <div className="status-count">{portfolioSummary.atRiskProjects}</div>
                    <div className="status-label">At Risk Projects</div>
                  </div>
                </div>
                <div className="status-card-compact critical">
                  <MdError />
                  <div className="status-info">
                    <div className="status-count">{portfolioSummary.criticalProjects}</div>
                    <div className="status-label">Critical Projects</div>
                  </div>
                </div>
              </div>

              {portfolioSummary.metricsNeedingAttention.length > 0 && (
                <div className="attention-section-compact">
                  <h4>Metrics Needing Attention</h4>
                  <div className="metrics-attention-list-compact">
                    {portfolioSummary.metricsNeedingAttention.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="attention-item-compact">
                        <div className="attention-project-compact">{item.projectName}</div>
                        <div className="attention-metric-compact">{item.metricName}</div>
                        <div className="attention-variance-compact">{item.variancePercent}% behind</div>
                      </div>
                    ))}
                    {portfolioSummary.metricsNeedingAttention.length > 3 && (
                      <div className="attention-more-compact">
                        +{portfolioSummary.metricsNeedingAttention.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Row: Horizontal Timeline */}
          {timelineData && (
            <div className="summary-timeline-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Project Timelines</h3>
                <div className="timeline-legend">
                  <span className="timeline-legend-item">
                    <span className="timeline-legend-bar" style={{ background: '#D0704d' }}></span>
                    ≤14 days
                  </span>
                  <span className="timeline-legend-item">
                    <span className="timeline-legend-bar" style={{ background: '#f5ad5b' }}></span>
                    15-30 days
                  </span>
                  <span className="timeline-legend-item">
                    <span className="timeline-legend-bar" style={{ background: '#8b5cf6' }}></span>
                    &gt;30 days
                  </span>
                  <span className="timeline-legend-item">
                    <span className="timeline-legend-bar" style={{ background: '#6b7280' }}></span>
                    Overdue
                  </span>
                </div>
              </div>
              <div className="horizontal-timeline-container">
                {/* Time axis - month labels above the timeline */}
                <div className="horizontal-timeline-axis">
                  <div className="timeline-axis-labels">
                    {timeMarkers.map((marker, idx) => (
                      <div
                        key={idx}
                        className="timeline-axis-marker"
                        style={{ left: `${marker.position}%` }}
                      >
                        <span className="timeline-axis-label">{marker.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project bars */}
                <div className="horizontal-timeline-projects">
                  {timelineData.projects.map((project) => {
                    const endPosition = getTimelinePosition(project.endDate);
                    const startPosition = project.startDate
                      ? getTimelinePosition(project.startDate)
                      : Math.max(0, endPosition - 10);

                    const projectMilestones = projectsMilestones[project.id] || [];
                    const daysRemaining = Math.ceil((project.endDate - new Date()) / (1000 * 60 * 60 * 24));
                    const statusColor = daysRemaining < 0 ? '#6b7280' : daysRemaining <= 14 ? '#D0704d' : daysRemaining <= 30 ? '#f5ad5b' : project.portfolio_color || '#539668';

                    // Get health score for this project
                    const projectHealthScore = portfolioSummary.projectHealthScores.find(p => p.projectId === project.id);
                    const healthScore = projectHealthScore ? projectHealthScore.score : 0;

                    return (
                      <div key={project.id} className="horizontal-timeline-row">
                        <div className="timeline-row-label">
                          {/* Health Gauge */}
                          <div className="health-score-gauge timeline-health-gauge">
                            <svg viewBox="0 0 36 36" className="health-gauge-svg">
                              <circle
                                className="health-gauge-bg"
                                cx="18"
                                cy="18"
                                r="15.5"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="3"
                              />
                              <circle
                                className="health-gauge-progress"
                                cx="18"
                                cy="18"
                                r="15.5"
                                fill="none"
                                strokeWidth="3"
                                stroke={getHealthColor(healthScore)}
                                strokeDasharray={`${(healthScore / 100) * 97.4} 97.4`}
                                strokeLinecap="round"
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                            <span className="health-gauge-value" style={{ color: getHealthColor(healthScore) }}>
                              {Math.round(healthScore)}
                            </span>
                          </div>
                          <span className="timeline-row-name" title={project.name}>{project.name}</span>
                        </div>
                        <div className="timeline-row-track">
                          {/* Project line */}
                          <div
                            className="timeline-row-line"
                            style={{
                              left: `${startPosition}%`,
                              width: `${Math.max(1, endPosition - startPosition)}%`,
                              background: statusColor
                            }}
                          />
                          {/* Start marker */}
                          <div
                            className="timeline-row-marker start"
                            style={{
                              left: `${startPosition}%`,
                              background: statusColor
                            }}
                          />
                          {/* Milestones */}
                          {projectMilestones.map((milestone) => {
                            const milestoneDate = new Date(milestone.target_date);
                            const milestonePosition = getTimelinePosition(milestoneDate);
                            if (milestonePosition < startPosition || milestonePosition > endPosition) return null;

                            return (
                              <div
                                key={milestone.id}
                                className={`timeline-row-milestone ${milestone.completed ? 'completed' : ''}`}
                                style={{ left: `${milestonePosition}%` }}
                              />
                            );
                          })}
                          {/* End marker */}
                          <div
                            className="timeline-row-marker end"
                            style={{
                              left: `${endPosition}%`,
                              background: statusColor
                            }}
                          />
                        </div>
                        <div className="timeline-row-countdown">
                          {daysRemaining >= 0 ? (
                            <span className="countdown-positive">{daysRemaining}d</span>
                          ) : (
                            <span className="countdown-negative">{Math.abs(daysRemaining)}d</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Today marker */}
                  <div
                    className="timeline-today-line"
                    style={{ left: `${nowPosition}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Row: Suggested Actions */}
          {suggestedActions.length > 0 && (
            <div className="suggested-actions-section">
              <h3>Suggested Actions</h3>
              <div className="suggested-actions-list">
                {suggestedActions.map((item, idx) => {
                  // Parse project names to make them bold
                  const renderProjectNames = (details) => {
                    if (!details) return null;
                    const parts = details.split(/(\+\d+ more)/);
                    return parts.map((part, i) => {
                      if (part.match(/\+\d+ more/)) {
                        return <span key={i}>{part}</span>;
                      }
                      // Split by commas and process each project
                      return part.split(',').map((projectStr, j) => {
                        const match = projectStr.trim().match(/^(.+?)\s*\(PM:\s*(.+?)\)$/);
                        if (match) {
                          return (
                            <span key={`${i}-${j}`}>
                              <strong>{match[1]}</strong>
                              <span style={{ fontWeight: 'normal' }}> (PM: {match[2]})</span>
                              {j < part.split(',').length - 1 ? ', ' : ''}
                            </span>
                          );
                        }
                        return <span key={`${i}-${j}`}>{projectStr}{j < part.split(',').length - 1 ? ',' : ''}</span>;
                      });
                    });
                  };

                  return (
                    <div key={idx} className={`suggested-action-item priority-${item.priority}`}>
                      <div className="action-content">
                        {item.details ? (
                          <div className="action-text">
                            {renderProjectNames(item.details)} {item.action}
                          </div>
                        ) : (
                          <div className="action-text">{item.action}</div>
                        )}
                        <div className="action-reason">{item.reason}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProjectSlide = (projectIndex) => {
    const project = portfolioProjects[projectIndex];
    if (!project) return null;

    const projectData = projectsData[project.id] || [];
    const projectMetrics = projectsMetrics[project.id] || [];
    const projectLinks = projectsLinks[project.id] || [];
    const projectRecoveryPlans = projectsRecoveryPlans[project.id] || [];
    const projectComments = projectsComments[project.id] || [];
    const projectMilestones = projectsMilestones[project.id] || [];

    const healthScores = calculateHealthScores(
      project,
      projectData,
      projectMetrics,
      projectRecoveryPlans,
      projectLinks
    );

    const clarityScore = calculateClarityScore(
      project.description || '',
      projectMetrics,
      projectData
    );

    // Prepare radar chart data for this project
    const projectRadarData = [
      { dimension: 'Project\nDescribed', score: healthScores.projectDescribed || 0 },
      { dimension: 'Metrics\nDescribed', score: healthScores.metricsDescribed || 0 },
      { dimension: 'Metric\nCoverage', score: healthScores.metricCoverage || 0 },
      { dimension: 'Metric\nManagement', score: healthScores.metricManagement || 0 },
      { dimension: 'Project\nControl', score: healthScores.projectControl || 0 },
      { dimension: 'Content\nClarity', score: healthScores.contentClarity || 0 }
    ];

    return (
      <div className="portfolio-review-slide project-slide">
        <div className="slide-header-with-gauge">
          {/* Health Gauge on the Left - Using consistent design */}
          <div className="health-score-gauge project-health-gauge">
            <svg viewBox="0 0 36 36" className="health-gauge-svg">
              <circle
                className="health-gauge-bg"
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                className="health-gauge-progress"
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3"
                stroke={getHealthColor(healthScores.overall)}
                strokeDasharray={`${(healthScores.overall / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="health-gauge-value" style={{ color: getHealthColor(healthScores.overall) }}>
              {Math.round(healthScores.overall)}<span className="percent-sign">%</span>
            </span>
          </div>

          {/* Project Title and Description */}
          <div className="project-header-text">
            <h1>
              {project.name}
              {(project.start_date || project.end_date) && (
                <span style={{ fontWeight: 400, fontSize: '16px', color: '#6b7280', marginLeft: '8px' }}>
                  [
                  {project.start_date && new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  {project.start_date && project.end_date && ' - '}
                  {project.end_date && new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  ]
                </span>
              )}
            </h1>
            {project.description && (
              <h2 className="project-description-header">{project.description}</h2>
            )}
          </div>
        </div>

        {/* Milestones Timeline */}
        {project.start_date && project.end_date && (
          <div style={{ margin: '0 16px 0 16px' }}>
            <ProjectTimelineBar
              startDate={project.start_date}
              endDate={project.end_date}
              milestones={projectMilestones}
            />
          </div>
        )}

        {/* Project Content - No tabs, just show everything */}
        <div className="project-content-section" style={{ marginTop: '0' }}>
          {/* Metrics Grid */}
          <div className="metrics-section" style={{ margin: '0 16px' }}>
            <div className="grid-view-container" style={{ gap: '8px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {projectMetrics.filter(m => m.show_in_portfolio_review !== 0).map((metric) => {
                const metricData = projectData.filter(d => d.metric_id === metric.id);
                if (metricData.length === 0) return null;

                return (
                  <div key={metric.id} className="grid-view-item" style={{ padding: '0' }}>
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
            {/* Show note if there are excluded metrics */}
            {isExporting && projectMetrics.filter(m => m.show_in_portfolio_review === 0).length > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: darkMode ? '#1e293b' : '#f8fafc',
                borderRadius: '4px',
                fontSize: '10px',
                color: darkMode ? '#94a3b8' : '#6b7280',
                fontStyle: 'italic',
                textAlign: 'center',
                border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0'
              }}>
                Note: {projectMetrics.filter(m => m.show_in_portfolio_review === 0).length} additional metric{projectMetrics.filter(m => m.show_in_portfolio_review === 0).length > 1 ? 's are' : ' is'} not shown (limited to metrics marked for Portfolio Review)
              </div>
            )}
          </div>

          {/* Commentary Section - Single box with Time User Comment per line */}
          {projectComments.length > 0 && (
            <div className="commentary-section" style={{
              margin: '16px 16px 8px 16px',
              borderTop: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
              paddingTop: '12px'
            }}>
              <h3 style={{
                fontSize: '11px',
                marginBottom: '8px',
                fontWeight: '600',
                color: darkMode ? '#94a3b8' : '#64748b'
              }}>Commentary</h3>
              <div className="commentary-box" style={{
                padding: '8px 10px',
                background: darkMode ? '#1e293b' : '#f8fafc',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: darkMode ? '#e2e8f0' : '#334155',
                border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0'
              }}>
                {/* Show only the latest comment, or all if expanded */}
                {(isExporting || !expandedComments[project.id] ? projectComments.slice(0, 1) : projectComments).map((comment, index) => {
                  const formatTime = (dateString) => {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                  };
                  const stripHtml = (html) => {
                    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  };
                  return (
                    <div key={comment.id} style={{ marginBottom: index < projectComments.length - 1 ? '4px' : '0' }}>
                      <span style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '600' }}>{formatTime(comment.created_at)}</span>
                      {' '}
                      <span style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '600' }}>{comment.creator_name || 'Unknown'}</span>
                      {' '}
                      <span>{stripHtml(comment.comment_text)}</span>
                    </div>
                  );
                })}
                {/* Show expand/collapse button if there are more than 1 comment and not exporting */}
                {projectComments.length > 1 && !isExporting && (
                  <button
                    onClick={() => setExpandedComments(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                    style={{
                      marginTop: '6px',
                      padding: '2px 0',
                      fontSize: '9px',
                      color: '#00aeef',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textDecoration: 'underline'
                    }}
                  >
                    {expandedComments[project.id] ? `Hide ${projectComments.length - 1} earlier comment${projectComments.length - 1 > 1 ? 's' : ''}` : `Show ${projectComments.length - 1} earlier comment${projectComments.length - 1 > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content portfolio-review-modal">
          <div className="loading-state">Loading portfolio data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content portfolio-review-modal fullscreen">
        <div className="modal-header">
          <h2>Portfolio Review: {portfolioName}</h2>
          <div className="modal-actions" style={{ borderTop: 'none', border: 'none' }}>
            <button
              className="export-btn icon-only"
              onClick={handleExportToPDF}
              title="Export to PDF"
              disabled={isExporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px',
                background: '#00aeef',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isExporting ? '14px' : '20px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1
              }}
            >
              {isExporting ? 'Exporting...' : <MdFileDownload />}
            </button>
            <button className="modal-close" onClick={onClose}>
              <MdClose />
            </button>
          </div>
        </div>

        <div className="modal-body" ref={slideRef}>
          {currentSlide === 0 ? renderSummarySlide() : renderProjectSlide(currentSlide - 1)}
        </div>

        <div className="modal-footer" style={{ border: 'none', borderTop: 'none', borderBottom: 'none', background: 'transparent', boxShadow: 'none' }}>
          <button
            className="nav-btn"
            onClick={handlePrevSlide}
            disabled={currentSlide === 0}
          >
            <MdArrowBack /> Previous
          </button>

          <div className="slide-indicators">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <div
                key={idx}
                className={`slide-dot ${idx === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(idx)}
              />
            ))}
          </div>

          <button
            className="nav-btn"
            onClick={handleNextSlide}
            disabled={currentSlide === totalSlides - 1}
          >
            Next <MdArrowForward />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortfolioReviewModal;
