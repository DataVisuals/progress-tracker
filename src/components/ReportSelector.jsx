import React, { useState } from 'react';
import Select from 'react-select';
import { selectStyles } from './SelectStyles';
import './PortfolioManager.css'; // Reuse portfolio manager styles

export default function ReportSelector({ spaces, portfolios, onClose, onGenerate }) {
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);

  // Filter portfolios based on selected space (defensive: check space_id exists)
  const filteredPortfolios = selectedSpace
    ? portfolios.filter(p => p.space_id && p.space_id === selectedSpace.value)
    : portfolios;

  const handleGenerate = () => {
    if (selectedPortfolio) {
      // Generate portfolio report
      onGenerate({ type: 'portfolio', id: selectedPortfolio.value, name: selectedPortfolio.label });
    } else if (selectedSpace && selectedSpace.value !== null) {
      // Generate space report
      onGenerate({ type: 'space', id: selectedSpace.value, name: selectedSpace.label });
    } else if (selectedSpace && selectedSpace.value === null) {
      // Generate all spaces report
      onGenerate({ type: 'all', id: null, name: 'All Spaces' });
    }
  };

  const canGenerate = selectedPortfolio || selectedSpace;

  return (
    <div className="portfolio-manager-overlay">
      <div className="portfolio-manager" style={{ maxWidth: '500px' }}>
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="portfolio-manager-header">
          <h2>Select Report</h2>
        </div>

        <div className="portfolio-manager-content">
          <div className="form-group">
            <label>Space</label>
            <Select
              styles={selectStyles}
              value={selectedSpace}
              onChange={(option) => {
                setSelectedSpace(option);
                setSelectedPortfolio(null); // Reset portfolio when space changes
              }}
              options={[
                { value: null, label: 'All Spaces' },
                ...spaces.map(space => ({
                  value: space.id,
                  label: space.name
                }))
              ]}
              isClearable
              placeholder="Select a space..."
            />
            <small className="form-hint">Select a space to view all portfolios in that space</small>
          </div>

          <div className="form-group">
            <label>Portfolio (Optional)</label>
            <Select
              styles={selectStyles}
              value={selectedPortfolio}
              onChange={setSelectedPortfolio}
              options={filteredPortfolios.map(portfolio => ({
                value: portfolio.id,
                label: portfolio.name
              }))}
              isClearable
              isDisabled={!selectedSpace}
              placeholder={selectedSpace ? "Select a portfolio..." : "Select a space first..."}
            />
            <small className="form-hint">
              {selectedSpace
                ? "Leave empty to view all portfolios in the space, or select one portfolio"
                : "Select a space first to choose a portfolio"}
            </small>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
