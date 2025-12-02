import React from 'react';
import { MdFavorite, MdArrowForward } from 'react-icons/md';

const getHealthColor = (score) => {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const ProjectHealthPanel = ({
  panelId,
  index,
  forDock,
  projectHealthRankings,
  healthRankingView,
  setHealthRankingView,
  hideInactiveProjects,
  setHideInactiveProjects,
  onNavigateToProject,
  onShowHealthModal
}) => {
  // Helper function to render a health ranking item
  const renderHealthItem = (project, idx, isTop) => (
    <div
      key={project.id}
      className="health-ranking-item"
      onClick={() => onNavigateToProject(project.id)}
    >
      <span className="health-rank">{idx + 1}</span>
      <div
        className="health-score-gauge clickable"
        onClick={(e) => {
          e.stopPropagation();
          if (onShowHealthModal) onShowHealthModal(project);
        }}
        title="Click for health breakdown"
      >
        <svg viewBox="0 0 36 36" className="health-gauge-svg">
          <circle
            className="health-gauge-bg"
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
          />
          <circle
            className="health-gauge-progress"
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            stroke={getHealthColor(project.healthScore)}
            strokeDasharray={`${(project.healthScore / 100) * 97.4} 97.4`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="health-gauge-value">{Math.round(project.healthScore)}<span className="percent-sign">%</span></span>
      </div>
      <div className="health-project-info">
        <span
          className="health-portfolio-dot"
          style={{ backgroundColor: project.portfolioColor }}
          title={project.portfolioName || 'No Portfolio'}
        />
        <span className="health-project-name">{project.name}</span>
        {project.initiative_manager && (
          <span className="health-pm-name">{project.initiative_manager}</span>
        )}
      </div>
      <MdArrowForward className="health-arrow" />
    </div>
  );

  // Fullscreen two-column layout
  if (forDock) {
    const top10 = projectHealthRankings.allSorted.slice(0, 10);
    const bottom10 = [...projectHealthRankings.allSorted].reverse().slice(0, 10);
    return (
      <div key={panelId} className={`home-quadrant health-rankings-quadrant fullscreen-health panel-${index + 1}`}>
        <div className="quadrant-content health-two-columns">
          <div className="health-column">
            <h3 className="health-column-title top-title">Top 10</h3>
            <div className="health-rankings-list">
              {top10.map((project, idx) => renderHealthItem(project, idx, true))}
            </div>
          </div>
          <div className="health-column">
            <h3 className="health-column-title bottom-title">Bottom 10</h3>
            <div className="health-rankings-list">
              {bottom10.map((project, idx) => renderHealthItem(project, idx, false))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular panel view with toggle
  const displayProjects = healthRankingView === 'top' ? projectHealthRankings.top : projectHealthRankings.bottom;
  return (
    <div key={panelId} className={`home-quadrant health-rankings-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdFavorite className="quadrant-icon" />
        <h2>Project Health</h2>
        <label className="active-filter-switch">
          <span className="switch-label">Active only</span>
          <div className="switch-track">
            <input
              type="checkbox"
              checked={hideInactiveProjects}
              onChange={(e) => setHideInactiveProjects(e.target.checked)}
            />
            <span className="switch-slider"></span>
          </div>
        </label>
        <div className="health-toggle-buttons">
          <button
            className={`health-toggle-btn ${healthRankingView === 'top' ? 'active' : ''}`}
            onClick={() => { setHealthRankingView('top'); localStorage.setItem('healthRankingView', 'top'); }}
          >
            Top 10
          </button>
          <button
            className={`health-toggle-btn ${healthRankingView === 'bottom' ? 'active' : ''}`}
            onClick={() => { setHealthRankingView('bottom'); localStorage.setItem('healthRankingView', 'bottom'); }}
          >
            Bottom 10
          </button>
        </div>
      </div>
      <div className="quadrant-content">
        {displayProjects.length === 0 ? (
          <div className="empty-quadrant">
            <p>No projects to display</p>
          </div>
        ) : (
          <div className="health-rankings-list">
            {displayProjects.map((project, idx) => renderHealthItem(project, idx, healthRankingView === 'top'))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHealthPanel;
