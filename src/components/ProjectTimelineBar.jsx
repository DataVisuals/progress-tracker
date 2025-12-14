import React from 'react';
import { MdCheckCircle, MdFlag, MdSwapHoriz } from 'react-icons/md';
import './ProjectTimelineBar.css';

const ProjectTimelineBar = ({ milestones, startDate, endDate, milestoneDateHistory = {}, startDateMoved = false, endDateMoved = false, startDateMoveCount = 0, endDateMoveCount = 0 }) => {
  const [hoveredElement, setHoveredElement] = React.useState(null);

  // Check if a milestone date has ever been moved
  const hasMilestoneDateMoved = (milestoneId) => {
    if (!milestoneId || !milestoneDateHistory) return false;
    const history = milestoneDateHistory[milestoneId];
    if (!history || !history.dateFieldsChanged) return false;
    return !!history.dateFieldsChanged['target_date'];
  };

  // Get the move count for tooltip
  const getMilestoneMoveCount = (milestoneId) => {
    if (!milestoneId || !milestoneDateHistory) return 0;
    const history = milestoneDateHistory[milestoneId];
    if (!history || !history.dateFieldsChanged || !history.dateFieldsChanged['target_date']) return 0;
    return history.dateFieldsChanged['target_date'].changeCount || 0;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getMilestoneStatus = (milestone) => {
    if (milestone.completed) return 'completed';
    const today = new Date();
    const targetDate = new Date(milestone.target_date);
    if (targetDate < today) return 'overdue';
    return 'upcoming';
  };

  const getDaysRemaining = (targetDate) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatTimeRemaining = (days) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    return `${Math.floor(days / 365)}y`;
  };

  // Sort milestones by date (handle empty array)
  const sortedMilestones = milestones && milestones.length > 0
    ? [...milestones].sort((a, b) => new Date(a.target_date) - new Date(b.target_date))
    : [];

  // Use project dates if provided, otherwise fall back to milestone dates with padding
  let firstDate, lastDate;

  if (startDate && endDate) {
    // Use project dates as timeline bounds
    firstDate = new Date(startDate);
    lastDate = new Date(endDate);
  } else if (sortedMilestones.length > 0) {
    // Fall back to milestone dates with padding for visual breathing room
    const firstMilestoneDate = new Date(sortedMilestones[0].target_date);
    const lastMilestoneDate = new Date(sortedMilestones[sortedMilestones.length - 1].target_date);
    const rawSpan = lastMilestoneDate - firstMilestoneDate;
    const padding = rawSpan * 0.05;
    firstDate = new Date(firstMilestoneDate.getTime() - padding);
    lastDate = new Date(lastMilestoneDate.getTime() + padding);
  } else {
    // No dates available at all, can't render
    return null;
  }

  const totalSpan = lastDate - firstDate;
  const today = new Date();

  // Calculate current date position (only show if within bounds)
  let todayPosition = null;
  if (today >= firstDate && today <= lastDate) {
    todayPosition = ((today - firstDate) / totalSpan) * 100;
    // Clamp to prevent overflow
    todayPosition = Math.max(5, Math.min(95, todayPosition));
  }

  // Calculate days to completion
  const daysToCompletion = getDaysRemaining(lastDate);

  const hasManyMilestones = sortedMilestones.length > 5;

  // Find the next upcoming milestone from today
  const nextMilestone = sortedMilestones.find(m => !m.completed && new Date(m.target_date) >= today);
  const nextMilestoneId = nextMilestone?.id;

  return (
    <div className="project-timeline-bar">
      <div className="timeline-header">
        <span className="timeline-start-date">{formatDate(firstDate)}</span>
        <span className="timeline-end-date">{formatDate(lastDate)}</span>
      </div>
      <div className={`timeline-track ${hasManyMilestones ? 'many-milestones' : ''}`}>
        {/* Timeline line */}
        <div className="timeline-line" />

        {/* Start marker */}
        <div
          className={`timeline-terminus start ${startDateMoved ? 'date-moved' : ''}`}
          onMouseEnter={() => setHoveredElement('start')}
          onMouseLeave={() => setHoveredElement(null)}
        >
          <div className="terminus-circle">
            {startDateMoved && <MdSwapHoriz className="terminus-moved-icon" />}
            <div className="terminus-label">Start</div>
          </div>
          {hoveredElement === 'start' && (
            <div className="terminus-tooltip">
              <strong>Project Start</strong>
              <span>{formatDate(firstDate)}</span>
              {startDateMoved && (
                <span className="tooltip-moved">Moved {startDateMoveCount} time{startDateMoveCount > 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>

        {/* Milestones */}
        {sortedMilestones.map((milestone, index) => {
          const status = getMilestoneStatus(milestone);
          const milestoneDate = new Date(milestone.target_date);
          let position = ((milestoneDate - firstDate) / totalSpan) * 100;

          // Clamp position to prevent overflow beyond boundaries
          position = Math.max(8, Math.min(92, position));

          const isAbove = index % 2 === 0; // Alternate above and below
          const isNextMilestone = milestone.id === nextMilestoneId;
          const hasMoved = hasMilestoneDateMoved(milestone.id);
          const moveCount = getMilestoneMoveCount(milestone.id);

          return (
            <div
              key={milestone.id}
              className={`timeline-stop ${status} ${isAbove ? 'above' : 'below'} ${isNextMilestone ? 'next-milestone' : ''} ${hasMoved ? 'date-moved' : ''}`}
              style={{ left: `${position}%` }}
              title={hasMoved
                ? `${milestone.title} - ${formatDate(milestone.target_date)} (moved ${moveCount} time${moveCount > 1 ? 's' : ''})`
                : `${milestone.title} - ${formatDate(milestone.target_date)}`
              }
            >
              <div className="stop-marker">
                {milestone.completed ? (
                  <MdCheckCircle className="stop-icon" />
                ) : hasMoved ? (
                  <div className="stop-dot moved">
                    <MdSwapHoriz className="moved-icon" />
                  </div>
                ) : (
                  <div className="stop-dot" />
                )}
              </div>
              {/* Only show label for next upcoming milestone to reduce clutter */}
              {isNextMilestone && (
                <>
                  <div className="stop-label">{milestone.title}</div>
                  <div className="stop-date">{formatShortDate(milestone.target_date)}</div>
                </>
              )}
            </div>
          );
        })}

        {/* End marker with time to completion */}
        <div
          className={`timeline-terminus end ${endDateMoved ? 'date-moved' : ''}`}
          onMouseEnter={() => setHoveredElement('end')}
          onMouseLeave={() => setHoveredElement(null)}
        >
          <div className="terminus-circle">
            {endDateMoved && <MdSwapHoriz className="terminus-moved-icon" />}
            <div className="terminus-label">End</div>
          </div>
          <div className="terminus-countdown">
            {daysToCompletion >= 0 ? (
              <span className="countdown-positive">{formatTimeRemaining(daysToCompletion)}</span>
            ) : (
              <span className="countdown-negative">{formatTimeRemaining(daysToCompletion)}</span>
            )}
          </div>
          {hoveredElement === 'end' && (
            <div className="terminus-tooltip">
              <strong>Project End</strong>
              <span>{formatDate(lastDate)}</span>
              <span className="tooltip-countdown">
                {daysToCompletion >= 0 ? `${formatTimeRemaining(daysToCompletion)} remaining` : `${formatTimeRemaining(daysToCompletion)}`}
              </span>
              {endDateMoved && (
                <span className="tooltip-moved">Moved {endDateMoveCount} time{endDateMoveCount > 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>

        {/* Current date indicator */}
        {todayPosition !== null && (
          <div className="timeline-today" style={{ left: `${todayPosition}%` }}>
            <div className="today-line" />
            <div className="today-label">Today</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTimelineBar;
