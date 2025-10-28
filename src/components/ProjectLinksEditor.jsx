import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './FormInputs.css';
import './ProjectSetup.css';

const ProjectLinksEditor = ({ projectId, onClose, onUpdate }) => {
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadLinks();
  }, [projectId]);

  const loadLinks = async () => {
    try {
      const response = await api.getProjectLinks(projectId);
      setLinks(response.data.length > 0 ? response.data : [{ id: null, label: '', url: '', display_order: 0 }]);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load project links:', err);
      setLinks([{ id: null, label: '', url: '', display_order: 0 }]);
      setIsLoading(false);
    }
  };

  const addLink = () => {
    const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.display_order || 0)) : -1;
    setLinks([...links, { id: null, label: '', url: '', display_order: maxOrder + 1 }]);
  };

  const removeLink = (index) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Get current links from server
      const currentResponse = await api.getProjectLinks(projectId);
      const currentLinks = currentResponse.data;

      // Determine which links to delete (existed before but not in new list)
      const currentIds = currentLinks.map(l => l.id);
      const newIds = links.filter(l => l.id).map(l => l.id);
      const idsToDelete = currentIds.filter(id => !newIds.includes(id));

      // Delete removed links
      for (const id of idsToDelete) {
        await api.deleteProjectLink(id);
      }

      // Update or create links
      for (let i = 0; i < links.length; i++) {
        const link = links[i];

        // Skip empty links
        if (!link.label.trim() || !link.url.trim()) continue;

        if (link.id) {
          // Update existing link
          await api.updateProjectLink(link.id, {
            label: link.label,
            url: link.url,
            display_order: i
          });
        } else {
          // Create new link
          await api.createProjectLink(projectId, {
            label: link.label,
            url: link.url,
            display_order: i
          });
        }
      }

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save project links:', err);
      alert('Failed to save project links: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="project-setup-container">
        <h2>Edit Project Links</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="project-setup-container">
      <h2>Edit Project Links</h2>
      <p className="setup-subtitle">Manage external resource links for this project</p>

      <div className="setup-section">
        <div className="section-header">
          <h3>External Links</h3>
          <button className="add-metric-btn" onClick={addLink}>
            + Add Link
          </button>
        </div>
        <div className="metrics-list">
          {links.map((link, index) => (
            <div key={index} className="link-row">
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(index, 'label', e.target.value)}
                  placeholder="e.g., JIRA, Confluence, SharePoint"
                />
              </div>
              <div className="form-group">
                <label>URL</label>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {links.length > 1 && (
                <button
                  className="remove-metric-btn"
                  onClick={() => removeLink(index)}
                  title="Remove link"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="help-text">
          <strong>External Links:</strong> Add links to external tools like JIRA, Confluence, or SharePoint. These will appear as buttons at the top of the project view.
        </p>
      </div>

      <div className="modal-actions">
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          className="cancel-btn"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProjectLinksEditor;
