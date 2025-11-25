import React, { useState, useRef, useEffect } from 'react';
import './PortfolioSelector.css'; // Reuse the same styles

export default function SpaceSelector({
  spaces,
  selectedSpace,
  onSpaceChange,
  onManageSpaces
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Find selected space data
  const selectedSpaceData = selectedSpace !== 'all'
    ? spaces.find(s => s.id === Number(selectedSpace))
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (spaceId) => {
    onSpaceChange(spaceId);
    setIsOpen(false);
  };

  const handleManageClick = () => {
    if (onManageSpaces) {
      onManageSpaces();
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  if (spaces.length === 0) {
    return null; // Don't show selector if no spaces
  }

  return (
    <div className="portfolio-selector" ref={dropdownRef} data-testid="space-selector-main">
      <label>Space:</label>
      <div className="portfolio-select-container">
        <div
          className={`portfolio-select-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="trigger-content">
            {selectedSpaceData ? (
              <span className="selected-text">{selectedSpaceData.name || 'Unnamed Space'}</span>
            ) : (
              <span className="placeholder-text">Space...</span>
            )}
          </div>
          <svg
            className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {isOpen && (
          <div className="portfolio-select-dropdown" role="listbox">
            {onManageSpaces && (
              <div className="portfolio-dropdown-header">
                <span className="header-title">Spaces</span>
                <div className="header-buttons">
                  <button
                    className="portfolio-manage-btn"
                    onClick={handleManageClick}
                    title="Manage Spaces"
                  >
                    Manage
                  </button>
                </div>
              </div>
            )}
            <div className="portfolio-options-list">
              <div
                className={`portfolio-option-item all-projects-option ${selectedSpace === 'all' ? 'selected' : ''}`}
                onClick={() => handleSelect('all')}
                role="option"
                aria-selected={selectedSpace === 'all'}
              >
                <div className="option-content">
                  <span className="option-name">All Spaces</span>
                </div>
              </div>
              {spaces.map(space => (
                <div
                  key={space.id}
                  className={`portfolio-option-item ${
                    selectedSpace === space.id || Number(selectedSpace) === space.id ? 'selected' : ''
                  }`}
                  onClick={() => handleSelect(space.id)}
                  role="option"
                  aria-selected={selectedSpace === space.id || Number(selectedSpace) === space.id}
                >
                  <div className="option-content">
                    <span className="option-name">{space.name || `Space ${space.id}`}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
