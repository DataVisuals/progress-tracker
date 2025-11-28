import React, { useState } from 'react';
import { MdSettings, MdCheck, MdClose, MdLock, MdDragIndicator } from 'react-icons/md';
import './DashboardConfigModal.css';

const DashboardConfigModal = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  isAdmin,
  panelConfig,
  layoutConfig
}) => {
  const [selectedLayout, setSelectedLayout] = useState(currentConfig.layout);
  const [selectedPanels, setSelectedPanels] = useState([...currentConfig.panels]);

  if (!isOpen) return null;

  const currentLayoutConfig = layoutConfig[selectedLayout];
  const requiredPanelCount = currentLayoutConfig?.panelCount || 4;

  // Get available panels (filter admin-only panels if not admin)
  const availablePanels = Object.values(panelConfig).filter(
    panel => !panel.adminOnly || isAdmin
  );

  // Handle layout selection
  const handleLayoutSelect = (layoutId) => {
    const newLayoutConfig = layoutConfig[layoutId];
    const newPanelCount = newLayoutConfig?.panelCount || 4;

    setSelectedLayout(layoutId);

    // Adjust panel count if needed
    if (selectedPanels.length > newPanelCount) {
      setSelectedPanels(selectedPanels.slice(0, newPanelCount));
    } else if (selectedPanels.length < newPanelCount) {
      // Add default panels to fill slots
      const defaultPanels = ['heatmap', 'metrics', 'commentary', 'inconsistencies', 'attention'];
      const newPanels = [...selectedPanels];
      for (const panelId of defaultPanels) {
        if (newPanels.length >= newPanelCount) break;
        if (!newPanels.includes(panelId)) {
          newPanels.push(panelId);
        }
      }
      setSelectedPanels(newPanels);
    }
  };

  // Handle panel selection for a slot
  const handlePanelSelect = (slotIndex, panelId) => {
    const newPanels = [...selectedPanels];

    // If panel is already selected elsewhere, swap
    const existingIndex = newPanels.indexOf(panelId);
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      // Swap the panels
      const temp = newPanels[slotIndex];
      newPanels[slotIndex] = panelId;
      newPanels[existingIndex] = temp;
    } else {
      newPanels[slotIndex] = panelId;
    }

    setSelectedPanels(newPanels);
  };

  // Handle save
  const handleSave = () => {
    onSave({
      layout: selectedLayout,
      panels: selectedPanels,
      lastModified: Date.now()
    });
  };

  // Handle reset to defaults - saves default config immediately
  const handleReset = () => {
    // Clear minimized panels (old legacy state)
    localStorage.removeItem('homePageMinimizedPanels');

    // Default configuration
    const defaultConfig = {
      layout: '2x2',
      panels: ['heatmap', 'metrics', 'commentary', 'inconsistencies'],
      lastModified: Date.now()
    };

    // Update local state to reflect reset
    setSelectedLayout('2x2');
    setSelectedPanels(['heatmap', 'metrics', 'commentary', 'inconsistencies']);

    // Save the default config (this will save to localStorage via onSave handler)
    onSave(defaultConfig);
  };

  // Layout previews
  const renderLayoutPreview = (layoutId) => {
    const config = layoutConfig[layoutId];
    switch (layoutId) {
      case '2x2':
        return (
          <div className="layout-preview layout-2x2-preview">
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
          </div>
        );
      case '2x1':
        return (
          <div className="layout-preview layout-2x1-preview">
            <div className="preview-cell" />
            <div className="preview-cell" />
          </div>
        );
      case '1x2':
        return (
          <div className="layout-preview layout-1x2-preview">
            <div className="preview-cell" />
            <div className="preview-cell" />
          </div>
        );
      case '1x1':
        return (
          <div className="layout-preview layout-1x1-preview">
            <div className="preview-cell" />
          </div>
        );
      case '2x2-1x1':
        return (
          <div className="layout-preview layout-2x2-1x1-preview">
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell preview-full-width" />
          </div>
        );
      case '3x2':
        return (
          <div className="layout-preview layout-3x2-preview">
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
            <div className="preview-cell" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dashboard-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <MdSettings className="modal-icon" />
          <h2>Configure Dashboard</h2>
          <button className="modal-close" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className="modal-body">
          {/* Layout Selection */}
          <div className="config-section">
            <h3>Layout</h3>
            <div className="layout-options">
              {Object.entries(layoutConfig).map(([layoutId, config]) => (
                <div
                  key={layoutId}
                  className={`layout-option ${selectedLayout === layoutId ? 'selected' : ''}`}
                  onClick={() => handleLayoutSelect(layoutId)}
                >
                  {renderLayoutPreview(layoutId)}
                  <span className="layout-name">{config.name}</span>
                  {selectedLayout === layoutId && <MdCheck className="selected-check" />}
                </div>
              ))}
            </div>
          </div>

          {/* Panel Selection */}
          <div className="config-section">
            <h3>Panels ({requiredPanelCount} slots)</h3>
            <div className="panel-slots">
              {Array.from({ length: requiredPanelCount }).map((_, index) => {
                const selectedPanelId = selectedPanels[index];
                const selectedPanelConfig = selectedPanelId ? panelConfig[selectedPanelId] : null;

                return (
                  <div key={index} className={`panel-slot ${index === requiredPanelCount - 1 && selectedLayout === '2x2-1x1' ? 'full-width' : ''}`}>
                    <div className="slot-header">
                      <span className="slot-number">Panel {index + 1}</span>
                      {selectedLayout === '2x2-1x1' && index === 4 && (
                        <span className="slot-hint">Full Width</span>
                      )}
                    </div>
                    <select
                      value={selectedPanelId || ''}
                      onChange={(e) => handlePanelSelect(index, e.target.value)}
                      className="panel-select"
                    >
                      <option value="">Select a panel...</option>
                      {availablePanels.map((panel) => {
                        const isUsedElsewhere = selectedPanels.includes(panel.id) && selectedPanels[index] !== panel.id;
                        return (
                          <option key={panel.id} value={panel.id}>
                            {panel.name}{panel.adminOnly ? ' (Admin)' : ''}{isUsedElsewhere ? ' *' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {selectedPanelConfig && (
                      <div className="panel-preview">
                        {React.createElement(selectedPanelConfig.icon, { className: 'panel-preview-icon' })}
                        <span>{selectedPanelConfig.name}</span>
                        {selectedPanelConfig.adminOnly && <MdLock className="admin-lock" title="Admin Only" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Panels Reference */}
          <div className="config-section panels-reference">
            <h3>Available Panels</h3>
            <div className="panels-grid">
              {availablePanels.map((panel) => {
                const isSelected = selectedPanels.includes(panel.id);
                return (
                  <div
                    key={panel.id}
                    className={`panel-chip ${isSelected ? 'selected' : ''} ${panel.adminOnly ? 'admin-only' : ''}`}
                  >
                    {React.createElement(panel.icon, { className: 'chip-icon' })}
                    <span>{panel.name}</span>
                    {panel.adminOnly && <MdLock className="admin-lock" title="Admin Only" />}
                    {isSelected && <MdCheck className="selected-check" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-danger" onClick={handleReset}>Reset to Defaults</button>
          <div className="footer-spacer" />
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Configuration</button>
        </div>
      </div>
    </div>
  );
};

export default DashboardConfigModal;
