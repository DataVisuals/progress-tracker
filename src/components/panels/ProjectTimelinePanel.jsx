import React, { useMemo, useState } from 'react';
import { MdDateRange, MdArrowForward } from 'react-icons/md';
import './ProjectTimelinePanel.css';

const ProjectTimelinePanel = ({
  panelId,
  index,
  forDock,
  projects,
  portfolios,
  selectedSpace,
  onNavigateToProject
}) => {
  const [hoveredProject, setHoveredProject] = useState(null);

  // Get projects with end dates, filtered by space
  const timelineData = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return { projects: [], range: null };

    // Filter projects with end dates
    let filteredProjects = projects.filter(p => p.end_date);

    // Filter by selected space (via portfolio)
    if (selectedSpace && selectedSpace !== 'all' && portfolios && portfolios.length > 0) {
      const spacePortfolioIds = portfolios
        .filter(p => p.space_id === parseInt(selectedSpace, 10))
        .map(p => p.id);
      filteredProjects = filteredProjects.filter(p =>
        !p.portfolio_id || spacePortfolioIds.includes(p.portfolio_id)
      );
    }

    if (filteredProjects.length === 0) return { projects: [], range: null };

    // Parse dates and sort by end date
    const projectsWithDates = filteredProjects.map(p => ({
      ...p,
      endDate: new Date(p.end_date),
      startDate: p.start_date ? new Date(p.start_date) : null
    })).sort((a, b) => a.endDate - b.endDate);

    // Calculate timeline range
    const now = new Date();
    const minDate = new Date(Math.min(now, ...projectsWithDates.map(p => p.startDate || p.endDate)));
    const maxDate = new Date(Math.max(...projectsWithDates.map(p => p.endDate)));

    // Add padding to range (1 month before, 2 months after)
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);

    return {
      projects: projectsWithDates,
      range: { min: minDate, max: maxDate, now }
    };
  }, [projects, portfolios, selectedSpace]);

  // Calculate position on timeline (0-100%)
  const getPosition = (date) => {
    if (!timelineData.range) return 0;
    const { min, max } = timelineData.range;
    const totalMs = max.getTime() - min.getTime();
    const dateMs = date.getTime() - min.getTime();
    return Math.max(0, Math.min(100, (dateMs / totalMs) * 100));
  };

  // Generate time markers for the timeline with adaptive granularity
  const getTimeMarkers = () => {
    if (!timelineData.range) return [];
    const { min, max } = timelineData.range;
    const markers = [];

    // Calculate span in months
    const spanMs = max.getTime() - min.getTime();
    const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30);

    // Determine step size based on span
    let stepMonths = 1;
    if (spanMonths > 36) stepMonths = 6; // > 3 years: every 6 months
    else if (spanMonths > 18) stepMonths = 3; // > 1.5 years: quarterly
    else if (spanMonths > 12) stepMonths = 2; // > 1 year: every 2 months

    const current = new Date(min);
    current.setDate(1); // Start from first of month

    // Align to step boundary
    if (stepMonths > 1) {
      const monthNum = current.getMonth();
      const alignedMonth = Math.ceil(monthNum / stepMonths) * stepMonths;
      current.setMonth(alignedMonth);
    }

    while (current <= max) {
      const position = getPosition(current);
      // Only add marker if it's not too close to edges (avoid clipping)
      if (position >= 3 && position <= 97) {
        markers.push({
          date: new Date(current),
          position,
          label: stepMonths >= 6
            ? current.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
            : current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        });
      }
      current.setMonth(current.getMonth() + stepMonths);
    }
    return markers;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate days until end date
  const getDaysRemaining = (endDate) => {
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status color based on days remaining
  const getStatusColor = (daysRemaining, project) => {
    if (daysRemaining < 0) return '#6b7280'; // Past - grey
    if (daysRemaining <= 14) return '#D0704d'; // Critical - red
    if (daysRemaining <= 30) return '#f5ad5b'; // Soon - amber
    return project.portfolio_color || '#539668'; // On track - portfolio color or green
  };

  const timeMarkers = getTimeMarkers();
  const nowPosition = timelineData.range ? getPosition(timelineData.range.now) : 0;

  // Render timeline content
  const renderTimeline = (isFullscreen = false) => {
    if (timelineData.projects.length === 0) {
      return (
        <div className="empty-quadrant">
          <p>No projects with end dates</p>
        </div>
      );
    }

    return (
      <div className={`timeline-container ${isFullscreen ? 'fullscreen' : ''}`}>
        {/* Timeline header with time markers */}
        <div className="timeline-header">
          <div className="timeline-axis">
            {timeMarkers.map((marker, idx) => (
              <div
                key={idx}
                className="timeline-month-marker"
                style={{ left: `${marker.position}%` }}
              >
                <span className="month-label">{marker.label}</span>
                <div className="month-tick" />
              </div>
            ))}
            {/* Today marker - positioned below the axis */}
            <div
              className="timeline-today-marker"
              style={{ left: `${nowPosition}%` }}
              title="Today"
            >
              <div className="today-line" />
            </div>
          </div>
        </div>

        {/* Project rows */}
        <div className="timeline-projects">
          {timelineData.projects.map((project, idx) => {
            const endPosition = getPosition(project.endDate);
            const startPosition = project.startDate ? getPosition(project.startDate) : Math.max(0, endPosition - 10);
            const daysRemaining = getDaysRemaining(project.endDate);
            const statusColor = getStatusColor(daysRemaining, project);
            const isHovered = hoveredProject === project.id;
            const isPast = daysRemaining < 0;

            return (
              <div
                key={project.id}
                className={`timeline-project-row ${isHovered ? 'hovered' : ''} ${isPast ? 'past' : ''}`}
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
                onClick={() => onNavigateToProject(project.id)}
              >
                {/* Project name label */}
                <div className="timeline-project-label">
                  <span
                    className="portfolio-dot"
                    style={{ backgroundColor: project.portfolio_color || '#6b7280' }}
                    title={project.portfolio_name || 'No Portfolio'}
                  />
                  <span className="project-name" title={project.name}>
                    {project.name}
                  </span>
                </div>

                {/* Timeline bar area */}
                <div className="timeline-bar-area">
                  {/* Project bar - connects start to end */}
                  <div
                    className={`timeline-bar ${project.startDate ? 'has-start' : 'no-start'}`}
                    style={{
                      left: `${startPosition}%`,
                      width: `${Math.max(1, endPosition - startPosition)}%`,
                      backgroundColor: statusColor,
                      opacity: isPast ? 0.5 : 1
                    }}
                  />

                  {/* Hover tooltip - show above for bottom entries, below for top entries */}
                  {isHovered && (
                    <div
                      className={`timeline-tooltip ${idx >= timelineData.projects.length - 3 ? 'tooltip-above' : 'tooltip-below'}`}
                      style={{ left: `${endPosition}%` }}
                    >
                      <div className="tooltip-content">
                        <strong>{project.name}</strong>
                        {project.startDate && (
                          <span className="tooltip-date">Start: {formatDate(project.startDate)}</span>
                        )}
                        <span className="tooltip-date">End: {formatDate(project.endDate)}</span>
                        <span className={`tooltip-days ${daysRemaining < 0 ? 'past' : daysRemaining <= 14 ? 'critical' : daysRemaining <= 30 ? 'soon' : ''}`}>
                          {daysRemaining < 0
                            ? `${Math.abs(daysRemaining)} days ago`
                            : daysRemaining === 0
                              ? 'Today'
                              : `${daysRemaining} days remaining`}
                        </span>
                        {project.initiative_manager && (
                          <span className="tooltip-pm">PM: {project.initiative_manager}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Days to completion badge */}
                <div
                  className="timeline-days-badge"
                  style={{ color: statusColor }}
                  title="Days to completion"
                >
                  {daysRemaining < 0
                    ? 'Done'
                    : daysRemaining === 0
                      ? 'Today'
                      : `in ${daysRemaining}d`}
                </div>

                <MdArrowForward className="timeline-arrow" />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Fullscreen/dock view
  if (forDock) {
    return (
      <div key={panelId} className={`home-quadrant timeline-quadrant fullscreen-timeline panel-${index + 1}`}>
        <div className="quadrant-content">
          {renderTimeline(true)}
        </div>
      </div>
    );
  }

  // Regular panel view
  return (
    <div key={panelId} className={`home-quadrant timeline-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdDateRange className="quadrant-icon" />
        <h2>Project Timeline</h2>
      </div>
      <div className="quadrant-content">
        {renderTimeline(false)}
      </div>
    </div>
  );
};

export default ProjectTimelinePanel;
