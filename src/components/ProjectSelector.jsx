import React from 'react';
import './ProjectSelector.css';

const ProjectSelector = ({ projects, selectedProject, onProjectChange }) => {
  return (
    <div className="project-selector">
      <label htmlFor="project-select" className="selector-label">
        Select Project:
      </label>
      <select
        id="project-select"
        value={selectedProject}
        onChange={(e) => onProjectChange(e.target.value)}
        className="selector-dropdown"
      >
        <option value="">-- Choose a Project --</option>
        {Object.entries(projects).map(([key, project]) => (
          <option key={key} value={key}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ProjectSelector;
