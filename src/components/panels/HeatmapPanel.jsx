import React from 'react';
import Select from 'react-select';
import { MdVisibility } from 'react-icons/md';
import { smallSelectStyles } from '../SelectStyles';

const HeatmapPanel = ({
  panelId,
  index,
  darkMode,
  forDock,
  pageHeatmap,
  viewsDays,
  setViewsDays,
  projects,
  onNavigateToProject,
  getDisplayLimit
}) => {
  return (
    <div key={panelId} className={`home-quadrant heatmap-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdVisibility className="quadrant-icon" />
        <h2>Most Viewed Projects</h2>
        <Select
          key={`views-days-${darkMode}`}
          className="portfolio-filter-dropdown"
          styles={smallSelectStyles}
          value={{ value: viewsDays, label: viewsDays === 1 ? 'Last 24 hours' : `Last ${viewsDays} days` }}
          onChange={(option) => {
            setViewsDays(option.value);
            localStorage.setItem('mostViewedProjectsDays', option.value.toString());
          }}
          options={[
            { value: 1, label: 'Last 24 hours' },
            { value: 7, label: 'Last 7 days' },
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' }
          ]}
          isSearchable={false}
        />
      </div>
      <div className="quadrant-content">
        {pageHeatmap && pageHeatmap.by_path ? (
          <div className="heatmap-list">
            {(() => {
              const projectItems = pageHeatmap.by_path.filter(item => item.path.startsWith('Project: '));
              const maxViews = projectItems[0]?.views || 1;
              const getHeatColor = (ratio) => {
                if (ratio > 0.75) return '#dc2626';
                if (ratio > 0.5) return '#f59e0b';
                if (ratio > 0.25) return '#10b981';
                return '#60a5fa';
              };
              return projectItems.slice(0, forDock ? 50 : getDisplayLimit()).map((item) => {
                const projectName = item.path.replace('Project: ', '');
                const ratio = item.views / maxViews;
                const heatColor = getHeatColor(ratio);
                return (
                  <div key={item.path} className="heatmap-row" onClick={() => {
                    const projectEntry = Object.entries(projects).find(([id, p]) => p.name === projectName);
                    if (projectEntry && onNavigateToProject) {
                      onNavigateToProject(parseInt(projectEntry[0]));
                    }
                  }}>
                    <span className="heatmap-name" title={projectName}>{projectName}</span>
                    <div className="heatmap-bar-container">
                      <div className="heatmap-bar" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: heatColor }} />
                    </div>
                    <span className="heatmap-views">{item.views}</span>
                  </div>
                );
              });
            })()}
            {pageHeatmap.by_path.filter(item => item.path.startsWith('Project: ')).length === 0 && (
              <div className="empty-state">No project views recorded yet</div>
            )}
          </div>
        ) : (
          <div className="empty-state">Loading view data...</div>
        )}
        <div className="heatmap-legend">
          <div className="legend-item"><span className="legend-color" style={{ background: '#dc2626' }} /><span>Hot</span></div>
          <div className="legend-item"><span className="legend-color" style={{ background: '#f59e0b' }} /><span>Warm</span></div>
          <div className="legend-item"><span className="legend-color" style={{ background: '#10b981' }} /><span>Cool</span></div>
          <div className="legend-item"><span className="legend-color" style={{ background: '#60a5fa' }} /><span>Cold</span></div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapPanel;
