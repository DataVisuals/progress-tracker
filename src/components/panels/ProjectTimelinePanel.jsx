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
  projectHealthRankings,
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

    // Calculate timeline range - include milestone dates
    const now = new Date();

    // Collect all milestone dates for the filtered projects
    const milestoneDates = [];
    if (milestones && typeof milestones === 'object') {
      const projectIds = new Set(projectsWithDates.map(p => p.id));
      // milestones is an object with project IDs as keys
      Object.entries(milestones).forEach(([projectId, projectMilestones]) => {
        if (projectIds.has(parseInt(projectId, 10)) && Array.isArray(projectMilestones)) {
          projectMilestones.forEach(m => {
            if (m.target_date) {
              milestoneDates.push(new Date(m.target_date));
            }
          });
        }
      });
    }

    // Calculate min/max considering project dates AND milestone dates
    const allDates = [
      now,
      ...projectsWithDates.map(p => p.startDate).filter(d => d !== null),
      ...projectsWithDates.map(p => p.endDate).filter(d => d !== null),
      ...milestoneDates
    ];

    const minDate = new Date(Math.min(...allDates.filter(d => d instanceof Date && !isNaN(d))));
    const maxDate = new Date(Math.max(...allDates.filter(d => d instanceof Date && !isNaN(d))));

    // Add padding to range (1 month before, 2 months after)
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);

    return {
      projects: projectsWithDates,
      range: { min: minDate, max: maxDate, now }
    };
  }, [projects, portfolios, selectedSpace, milestones]);

  // Calculate position on timeline (0-100%)
  const getPosition = (date) => {
    if (!timelineData.range) return 0;
    const { min, max } = timelineData.range;
    const totalMs = max.getTime() - min.getTime();
    const dateMs = date.getTime() - min.getTime();
    return Math.max(0, Math.min(100, (dateMs / totalMs) * 100));
  };

  // Generate time markers for the timeline - show all months
  const getTimeMarkers = () => {
    if (!timelineData.range) return [];
    const { min, max } = timelineData.range;
    const markers = [];

    const current = new Date(min);
    current.setDate(1); // Start from first of month

    while (current <= max) {
      const position = getPosition(current);
      // Show all markers within reasonable bounds to ensure milestone dates are labeled
      // Allow markers from 0% to 100% to show full timeline coverage
      if (position >= 0 && position <= 100) {
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

  // Get status color based on project health score
  const getStatusColor = (daysRemaining, project) => {
    // For past projects, use grey
    if (daysRemaining < 0) return '#6b7280'; // Past - grey

    // Get health score for this project from projectHealthRankings
    const projectWithHealth = projectHealthRankings?.allSorted?.find(p => p.id === project.id);
    const healthScore = projectWithHealth?.healthScore ?? null;

    // If health score is available, use RAG colors based on health
    if (healthScore !== null && healthScore !== undefined) {
      if (healthScore >= 80) return '#539668'; // Green - healthy
      if (healthScore >= 60) return '#f5ad5b'; // Amber - at risk
      return '#D0704d'; // Red - critical
    }

    // Fallback to time-based status if no health score
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
        {/* Scrollable content wrapper */}
        <div className="timeline-scroll-wrapper">
          {/* Time axis header - sticky */}
          <div className="timeline-axis-sticky">
            <div className="timeline-axis">
              <div className="timeline-axis-label-spacer" />
              <div className="timeline-axis-track-wrapper">
                <div className="timeline-axis-track">
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
              <div className="timeline-axis-countdown-spacer" />
            </div>
          </div>
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
                <div
                  className="timeline-project-label"
                  onMouseEnter={() => setHoveredProject(project.id)}
                  onMouseLeave={() => setHoveredProject(null)}
                  title=""
                >
                  <span
                    className="portfolio-dot"
                    style={{ backgroundColor: project.portfolio_color || '#6b7280' }}
                    title={project.portfolio_name || 'No Portfolio'}
                  />
                  <span className="project-name" title="">
                    {project.name}
                  </span>
                  {hoveredProject === project.id && (
                    <div className="project-label-tooltip">
                      <strong>{project.name}</strong>
                      <span className="tooltip-date">
                        {project.startDate ? formatDate(project.startDate) : 'No start'} → {formatDate(project.endDate)}
                      </span>
                      {project.initiative_manager && (
                        <span className="tooltip-pm">PM: {project.initiative_manager}</span>
                      )}
                    </div>
                  )}
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
                    onMouseEnter={() => setHoveredProject(project.id)}
                    onMouseLeave={() => setHoveredProject(null)}
                  >
                    <div className="terminus-circle" style={{ background: statusColor }} />
                    {hoveredProject === project.id && (
                      <div className="project-tooltip start-tooltip">
                        <strong>{project.name}</strong>
                        {project.startDate && (
                          <span className="tooltip-date">Start: {formatDate(project.startDate)}</span>
                        )}
                        {project.initiative_manager && (
                          <span className="tooltip-pm">PM: {project.initiative_manager}</span>
                        )}
                      </div>
                    )}
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
                            {milestone.completed === 1 && <span className="completed-badge">✓ Complete</span>}
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

                  {/* Today marker - inside track for correct positioning */}
                  {timelineData.range && (
                    <div
                      className="timeline-today-marker-row"
                      style={{ left: `${nowPosition}%` }}
                    >
                      <div className="today-line-segment" />
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
