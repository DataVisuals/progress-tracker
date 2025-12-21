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

  // Get available panels (filter admin-only and dock-only panels)
  const availablePanels = Object.values(panelConfig).filter(
    panel => !panel.dockOnly && (!panel.adminOnly || isAdmin)
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
            <h3>Panel Configuration</h3>
            <div className={`panel-slots-grid layout-grid-${selectedLayout}`}>
              {Array.from({ length: requiredPanelCount }).map((_, index) => {
                const selectedPanelId = selectedPanels[index];
                const selectedPanelConfig = selectedPanelId ? panelConfig[selectedPanelId] : null;

                return (
                  <div key={index} className={`panel-slot-wrapper ${index === requiredPanelCount - 1 && selectedLayout === '2x2-1x1' ? 'full-width' : ''}`}>
                    <div className="slot-header">
                      <MdDragIndicator className="drag-icon" />
                      <span className="slot-number">Slot {index + 1}</span>
                      {selectedLayout === '2x2-1x1' && index === 4 && (
                        <span className="slot-hint">Full Width</span>
                      )}
                    </div>

                    {/* Current selection */}
                    {selectedPanelConfig && (
                      <div className="current-selection">
                        <div className="selected-panel-card">
                          {React.createElement(selectedPanelConfig.icon, { className: 'selected-panel-icon' })}
                          <div className="selected-panel-info">
                            <span className="selected-panel-name">{selectedPanelConfig.name}</span>
                            {selectedPanelConfig.adminOnly && <MdLock className="admin-indicator" />}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Available panels grid */}
                    <div className="panel-thumbnails">
                      {availablePanels.map((panel) => {
                        const isSelected = selectedPanels[index] === panel.id;
                        const isUsedElsewhere = selectedPanels.includes(panel.id) && selectedPanels[index] !== panel.id;

                        return (
                          <div
                            key={panel.id}
                            className={`panel-thumbnail ${isSelected ? 'selected' : ''} ${isUsedElsewhere ? 'used-elsewhere' : ''}`}
                            onClick={() => handlePanelSelect(index, panel.id)}
                            title={`${panel.name}${panel.adminOnly ? ' (Admin Only)' : ''}${isUsedElsewhere ? ' - Used in another slot' : ''}`}
                          >
                            {React.createElement(panel.icon, { className: 'thumbnail-icon' })}
                            <span className="thumbnail-label">{panel.name}</span>
                            {panel.adminOnly && <MdLock className="thumbnail-lock" />}
                            {isSelected && <MdCheck className="thumbnail-check" />}
                            {isUsedElsewhere && <span className="used-indicator">•</span>}
                          </div>
                        );
                      })}
                    </div>
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
