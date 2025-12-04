import React from 'react';
import { MdCheckCircle, MdFlag } from 'react-icons/md';
import './ProjectTimelineBar.css';

const ProjectTimelineBar = ({ milestones }) => {
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

  if (!milestones || milestones.length === 0) {
    return null;
  }

  // Sort milestones by date
  const sortedMilestones = [...milestones].sort((a, b) =>
    new Date(a.target_date) - new Date(b.target_date)
  );

  // Use first and last milestone dates as timeline bounds with some padding
  const firstMilestoneDate = new Date(sortedMilestones[0].target_date);
  const lastMilestoneDate = new Date(sortedMilestones[sortedMilestones.length - 1].target_date);

  // Add 5% padding on each side for visual breathing room
  const rawSpan = lastMilestoneDate - firstMilestoneDate;
  const padding = rawSpan * 0.05;

  const firstDate = new Date(firstMilestoneDate.getTime() - padding);
  const lastDate = new Date(lastMilestoneDate.getTime() + padding);
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
  const daysToCompletion = getDaysRemaining(lastMilestoneDate);

  return (
    <div className="project-timeline-bar">
      <div className="timeline-track">
        {/* Timeline line */}
        <div className="timeline-line" />

        {/* Start marker */}
        <div className="timeline-terminus start">
          <div className="terminus-circle" />
          <div className="terminus-label">Start</div>
          <div className="terminus-date">{formatShortDate(firstMilestoneDate)}</div>
        </div>

        {/* Milestones */}
        {sortedMilestones.map((milestone, index) => {
          const status = getMilestoneStatus(milestone);
          const milestoneDate = new Date(milestone.target_date);
          let position = ((milestoneDate - firstDate) / totalSpan) * 100;

          // Clamp position to prevent overflow beyond boundaries
          position = Math.max(8, Math.min(92, position));

          const isAbove = index % 2 === 0; // Alternate above and below

          return (
            <div
              key={milestone.id}
              className={`timeline-stop ${status} ${isAbove ? 'above' : 'below'}`}
              style={{ left: `${position}%` }}
              title={`${milestone.title} - ${formatDate(milestone.target_date)}`}
            >
              <div className="stop-marker">
                {milestone.completed ? (
                  <MdCheckCircle className="stop-icon" />
                ) : (
                  <div className="stop-dot" />
                )}
              </div>
              <div className="stop-label">{milestone.title}</div>
              <div className="stop-date">{formatShortDate(milestone.target_date)}</div>
            </div>
          );
        })}

        {/* End marker with time to completion */}
        <div className="timeline-terminus end">
          <div className="terminus-circle" />
          <div className="terminus-label">End</div>
          <div className="terminus-date">{formatShortDate(lastMilestoneDate)}</div>
          <div className="terminus-countdown">
            {daysToCompletion >= 0 ? (
              <span className="countdown-positive">{formatTimeRemaining(daysToCompletion)}</span>
            ) : (
              <span className="countdown-negative">{formatTimeRemaining(daysToCompletion)}</span>
            )}
          </div>
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
