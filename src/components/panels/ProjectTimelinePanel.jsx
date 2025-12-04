import React, { useMemo, useState } from 'react';
import { MdDateRange, MdCheckCircle } from 'react-icons/md';
import './ProjectTimelinePanel.css';

const ProjectTimelinePanel = ({
  panelId,
  index,
  forDock,
  projects,
  portfolios,
  selectedSpace,
  milestones,
  onNavigateToProject
}) => {
  const [hoveredProject, setHoveredProject] = useState(null);
  const [hoveredMilestone, setHoveredMilestone] = useState(null);

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
        p.portfolio_id && spacePortfolioIds.includes(p.portfolio_id)
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

  // Format time remaining
  const formatTimeRemaining = (days) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    return `${Math.floor(days / 365)}y`;
  };

  // Get milestone status
  const getMilestoneStatus = (milestone) => {
    if (milestone.completed) return 'completed';
    const today = new Date();
    const targetDate = new Date(milestone.target_date);
    if (targetDate < today) return 'overdue';
    return 'upcoming';
  };

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
        {/* Project rows with tubemap design */}
        <div className="timeline-projects">
          {timelineData.projects.map((project) => {
            const endPosition = getPosition(project.endDate);
            const startPosition = project.startDate ? getPosition(project.startDate) : Math.max(0, endPosition - 10);
            const daysRemaining = getDaysRemaining(project.endDate);
            const statusColor = getStatusColor(daysRemaining, project);
            const isPast = daysRemaining < 0;

            // Get project milestones
            const projectMilestones = (milestones && milestones[project.id]) || [];
            const sortedMilestones = [...projectMilestones].sort((a, b) =>
              new Date(a.target_date) - new Date(b.target_date)
            );

            return (
              <div
                key={project.id}
                className={`timeline-project-row tubemap ${isPast ? 'past' : ''}`}
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

                {/* Tubemap track */}
                <div className="tubemap-track">
                  {/* Timeline line */}
                  <div
                    className="tubemap-line"
                    style={{
                      left: `${startPosition}%`,
                      width: `${Math.max(1, endPosition - startPosition)}%`,
                      background: `linear-gradient(to right, ${statusColor}, ${statusColor})`
                    }}
                  />

                  {/* Start terminus */}
                  <div
                    className="tubemap-terminus start"
                    style={{ left: `${startPosition}%` }}
                  >
                    <div className="terminus-circle" style={{ background: statusColor }} />
                  </div>

                  {/* Milestones */}
                  {sortedMilestones.map((milestone) => {
                    const milestoneDate = new Date(milestone.target_date);
                    const milestonePosition = getPosition(milestoneDate);
                    const status = getMilestoneStatus(milestone);

                    // Only show milestone if it's within project bounds
                    if (milestonePosition < startPosition || milestonePosition > endPosition) return null;

                    return (
                      <div
                        key={milestone.id}
                        className={`tubemap-stop ${status}`}
                        style={{ left: `${milestonePosition}%` }}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredMilestone(milestone.id);
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          setHoveredMilestone(null);
                        }}
                      >
                        <div className="stop-marker">
                          {milestone.completed ? (
                            <MdCheckCircle className="stop-icon" />
                          ) : (
                            <div className="stop-dot" />
                          )}
                        </div>
                        {hoveredMilestone === milestone.id && (
                          <div className="milestone-tooltip">
                            <strong>{milestone.title}</strong>
                            <span>{formatDate(milestoneDate)}</span>
                            {milestone.completed && <span className="completed-badge">✓ Complete</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* End terminus */}
                  <div
                    className="tubemap-terminus end"
                    style={{ left: `${endPosition}%` }}
                    onMouseEnter={() => setHoveredProject(project.id)}
                    onMouseLeave={() => setHoveredProject(null)}
                  >
                    <div className="terminus-circle" style={{ background: statusColor }} />
                    {hoveredProject === project.id && (
                      <div className="project-tooltip">
                        <strong>{project.name}</strong>
                        {project.startDate && (
                          <span className="tooltip-date">Start: {formatDate(project.startDate)}</span>
                        )}
                        <span className="tooltip-date">End: {formatDate(project.endDate)}</span>
                        {project.initiative_manager && (
                          <span className="tooltip-pm">PM: {project.initiative_manager}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Today marker */}
                  {nowPosition >= startPosition && nowPosition <= endPosition && (
                    <div className="tubemap-today" style={{ left: `${nowPosition}%` }}>
                      <div className="today-line" />
                    </div>
                  )}
                </div>

                {/* Time remaining badge */}
                <div className="project-countdown-badge">
                  {daysRemaining >= 0 ? (
                    <span className="countdown-positive">{formatTimeRemaining(daysRemaining)}</span>
                  ) : (
                    <span className="countdown-negative">{formatTimeRemaining(daysRemaining)}</span>
                  )}
                </div>
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
