import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import CRAIDs from './components/CRAIDs';
import { api } from './api/client';
import { MdShowChart } from 'react-icons/md';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectData, setProjectData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [showDataGrid, setShowDataGrid] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectManager, setNewProjectManager] = useState('');

  // Load projects when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  // Load project data when project selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
    }
  }, [selectedProject]);

  // Auto-select first metric when project data loads
  useEffect(() => {
    if (projectData.length > 0 && !selectedMetric) {
      const uniqueMetrics = [...new Set(projectData.map(item => item.metric))];
      if (uniqueMetrics.length > 0) {
        setSelectedMetric(uniqueMetrics[0]);
      }
    }
  }, [projectData]);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadProjectData = async () => {
    try {
      const response = await api.getProjectData(selectedProject);
      setProjectData(response.data);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    setSelectedMetric(''); // Reset metric when changing projects
  };

  const handleMetricChange = (metric) => {
    setSelectedMetric(metric);
  };

  const handleCommentaryChange = async (itemId, newCommentary) => {
    try {
      await api.patchPeriod(itemId, { commentary: newCommentary });
      // Update local state
      setProjectData(prevData =>
        prevData.map(item =>
          item.id === itemId ? { ...item, commentary: newCommentary } : item
        )
      );
    } catch (err) {
      console.error('Failed to update commentary:', err);
    }
  };

  const handleDataGridChange = async (updatedData) => {
    try {
      // Separate new and existing periods
      for (const item of updatedData) {
        const original = projectData.find(p => p.id === item.id);

        if (!original) {
          // This is a new period - create it
          await api.createPeriod({
            metric_id: item.metric_id,
            reporting_date: item.reporting_date,
            expected: item.expected,
            target: item.final_target,
            complete: item.complete
          });
        } else if (original.complete !== item.complete ||
                   original.expected !== item.expected ||
                   original.final_target !== item.final_target) {
          // This is an existing period - update it
          await api.updatePeriod(item.id, {
            complete: item.complete,
            expected: item.expected,
            target: item.final_target
          });
        }
      }
      // Reload project data
      await loadProjectData();
    } catch (err) {
      console.error('Failed to update data:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const response = await api.createProject({
        name: newProjectName,
        description: newProjectDesc,
        initiative_manager: newProjectManager
      });
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectManager('');
      setShowNewProject(false);
      await loadProjects();
      // Auto-select the newly created project
      setSelectedProject(response.data.id.toString());
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    const project = projects.find(p => p.id === parseInt(selectedProject));
    if (!confirm(`Are you sure you want to delete "${project?.name}"? This will delete all metrics and data.`)) {
      return;
    }

    try {
      await api.deleteProject(selectedProject);
      setSelectedProject('');
      await loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project');
    }
  };

  const handleMetricCreated = async (metricName) => {
    // Reload project data to include the new metric
    await loadProjectData();
    // Select the newly created metric
    setSelectedMetric(metricName);
  };

  const handleMetricRename = async (oldName, newName) => {
    try {
      // Find the metric ID from the project data
      const metricData = projectData.find(item => item.metric === oldName);
      if (!metricData) return;

      await api.updateMetric(metricData.metric_id, { name: newName });

      // Reload project data
      await loadProjectData();

      // Update selected metric if it was the one being renamed
      if (selectedMetric === oldName) {
        setSelectedMetric(newName);
      }
    } catch (err) {
      console.error('Failed to rename metric:', err);
      alert('Failed to rename metric');
    }
  };

  // Convert projects array to object format for ProjectSelector
  const projectsObject = projects.reduce((acc, project) => {
    acc[project.id] = { name: project.name };
    return acc;
  }, {});

  // Get unique metrics from project data
  const metrics = selectedProject
    ? [...new Set(projectData.map(item => item.metric))]
    : [];

  const projectName = selectedProject
    ? projects.find(p => p.id === parseInt(selectedProject))?.name || ''
    : '';

  const currentProjectData = projectData;

  return (
    <div className="app">
      <header className="app-header-main">
        <div className="header-content">
          <div className="header-left">
            <h1>
              <MdShowChart className="app-logo" />
              Progress Tracker
            </h1>
          </div>
          <div className="header-right">
            <ProjectSelector
              projects={projectsObject}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
            />
            <button className="new-project-btn" onClick={() => setShowNewProject(true)}>
              + New Project
            </button>
            {selectedProject && (
              <>
                <button className="delete-project-btn" onClick={handleDeleteProject}>
                  Delete Project
                </button>
                <button className="edit-data-btn" onClick={() => setShowDataGrid(true)}>
                  Edit Data
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="app-container">

        {selectedProject && (
          <div className="report-section">
            <div className="report-header">
              <div>
                <h2>{projectName}</h2>
              </div>
              <p className="report-meta">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>

            {metrics.length > 0 && (
              <MetricTabs
                metrics={metrics}
                selectedMetric={selectedMetric}
                onMetricChange={handleMetricChange}
                onMetricRename={handleMetricRename}
              />
            )}

            {selectedMetric && (
              <div className="metrics-container">
                <MetricChart
                  key={selectedMetric}
                  metricName={selectedMetric}
                  data={projectData.filter(item => item.metric === selectedMetric)}
                  onCommentaryChange={handleCommentaryChange}
                />
              </div>
            )}

            <CRAIDs projectId={selectedProject} />
          </div>
        )}

        {!selectedProject && (
          <div className="empty-state">
            <svg
              className="empty-state-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3>Select a Project to Begin</h3>
            <p>Choose a project from the dropdown above to view metrics and reports</p>
          </div>
        )}
      </div>

      {showDataGrid && (
        <DataGrid
          data={currentProjectData}
          metrics={metrics}
          onDataChange={handleDataGridChange}
          onClose={() => setShowDataGrid(false)}
          projectId={selectedProject}
          onMetricCreated={handleMetricCreated}
        />
      )}

      {showNewProject && (
        <div className="modal-overlay" onClick={() => setShowNewProject(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Project</h2>
            <div className="form-group">
              <label htmlFor="project-name">Project Name:</label>
              <input
                id="project-name"
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="project-manager">Project Manager:</label>
              <input
                id="project-manager"
                type="text"
                value={newProjectManager}
                onChange={(e) => setNewProjectManager(e.target.value)}
                placeholder="Enter project manager name..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="project-desc">Description (optional):</label>
              <textarea
                id="project-desc"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Enter project description..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleCreateProject}>
                Create
              </button>
              <button className="cancel-btn" onClick={() => setShowNewProject(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
