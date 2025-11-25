import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './ProjectDependencies.css';

const ProjectDependencies = ({
  projectId,
  allProjects,
  canEdit = false,
  onNavigateToProject
}) => {
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [showHover, setShowHover] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const linkRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    if (projectId) {
      loadDependencies();
    }
  }, [projectId]);

  const loadDependencies = async () => {
    try {
      setLoading(true);
      const response = await api.getProjectDependencies(projectId);
      setDependencies(response.data);
    } catch (err) {
      console.error('Failed to load dependencies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDependency = async (option) => {
    if (!option) return;

    try {
      await api.addProjectDependency(projectId, option.value);
      await loadDependencies();
      setShowSelector(false);
    } catch (err) {
      console.error('Failed to add dependency:', err);
      alert(err.response?.data?.error || 'Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (dependencyId, e) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await api.removeProjectDependency(projectId, dependencyId);
      await loadDependencies();
    } catch (err) {
      console.error('Failed to remove dependency:', err);
      alert(err.response?.data?.error || 'Failed to remove dependency');
    }
  };

  const handleMouseEnter = () => {
    if (linkRef.current) {
      const rect = linkRef.current.getBoundingClientRect();
      setHoverPosition({
        x: rect.left,
        y: rect.bottom + 4
      });
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowHover(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowHover(false);
  };

  const handleProjectClick = (dep) => {
    if (onNavigateToProject) {
      onNavigateToProject(dep.depends_on_project_id);
      setShowHover(false);
    }
  };

  // Get available projects (exclude current project and already-added dependencies)
  const availableProjects = Object.entries(allProjects || {})
    .filter(([id]) => {
      const projectIdNum = parseInt(id);
      return projectIdNum !== parseInt(projectId) &&
             !dependencies.some(d => d.depends_on_project_id === projectIdNum);
    })
    .map(([id, project]) => ({
      value: parseInt(id),
      label: project.name,
      portfolio_color: project.portfolio_color
    }));

  const getRagColor = (status) => {
    switch (status) {
      case 'red': return '#dc2626';
      case 'amber': return '#f59e0b';
      case 'green': return '#10b981';
      default: return '#9ca3af';
    }
  };

  if (loading) {
    return null;
  }

  // Hide completely when no dependencies and can't edit
  if (dependencies.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="project-dependencies">
      {dependencies.length > 0 ? (
        <>
          <span
            ref={linkRef}
            className="depends-on-link"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            Depends on {dependencies.length} project{dependencies.length !== 1 ? 's' : ''}
          </span>
          {canEdit && (
            <button
              className="edit-deps-btn"
              onClick={() => setShowSelector(true)}
              title="Manage dependencies"
            >
              Edit
            </button>
          )}
        </>
      ) : canEdit && (
        <button
          className="add-dependency-link"
          onClick={() => setShowSelector(true)}
        >
          + Dependencies
        </button>
      )}

      {showSelector && (
        <div className="dependency-selector-overlay" onClick={() => setShowSelector(false)}>
          <div
            className="dependency-selector"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dependency-selector-header">
              <h4>Manage Dependencies</h4>
              <button onClick={() => setShowSelector(false)}>×</button>
            </div>

            {dependencies.length > 0 && (
              <div className="current-dependencies">
                <div className="current-deps-label">Current dependencies:</div>
                {dependencies.map((dep) => (
                  <div key={dep.id} className="current-dep-item">
                    <span
                      className="dep-rag-dot"
                      style={{ backgroundColor: getRagColor(dep.rag_status) }}
                    />
                    <span className="dep-name">{dep.project_name}</span>
                    <button
                      className="dep-remove-btn"
                      onClick={(e) => handleRemoveDependency(dep.id, e)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-dep-section">
              <div className="add-dep-label">Add dependency:</div>
              <Select
                autoFocus
                placeholder="Search projects..."
                options={availableProjects}
                onChange={handleAddDependency}
                styles={{
                  ...selectStyles,
                  menu: (base) => ({ ...base, position: 'relative' }),
                  menuList: (base) => ({ ...base, maxHeight: '200px' })
                }}
                formatOptionLabel={(option) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {option.portfolio_color && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: option.portfolio_color
                        }}
                      />
                    )}
                    {option.label}
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      )}

      {showHover && dependencies.length > 0 && (
        <div
          className="dependencies-hover"
          style={{
            position: 'fixed',
            left: hoverPosition.x,
            top: hoverPosition.y,
            zIndex: 10000
          }}
          onMouseEnter={() => setShowHover(true)}
          onMouseLeave={handleMouseLeave}
        >
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="hover-dep-row"
              onClick={() => handleProjectClick(dep)}
            >
              <span
                className="hover-rag"
                style={{ backgroundColor: getRagColor(dep.rag_status) }}
              />
              <div className="hover-dep-info">
                <span className="hover-dep-name">{dep.project_name}</span>
                {dep.portfolio_name && (
                  <span className="hover-dep-portfolio">{dep.portfolio_name}</span>
                )}
              </div>
            </div>
          ))}
          <div className="hover-hint">Click to view project</div>
        </div>
      )}
    </div>
  );
};

export default ProjectDependencies;
