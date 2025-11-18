import React, { useState, useRef, useEffect } from 'react';
import './PortfolioSelector.css';

export default function PortfolioSelector({
  portfolios,
  selectedPortfolio,
  onPortfolioChange,
  onManagePortfolios
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalize selectedPortfolio to number for comparison (handle null, undefined, string)
  const normalizedPortfolioId = selectedPortfolio != null ? Number(selectedPortfolio) : null;
  const selectedPortfolioData = portfolios.find(p => p.id === normalizedPortfolioId);

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

  const handleSelect = (portfolioId) => {
    onPortfolioChange(portfolioId);
    setIsOpen(false);
  };

  const handleManageClick = () => {
    if (onManagePortfolios) {
      onManagePortfolios();
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

  return (
    <div className="portfolio-selector" ref={dropdownRef} data-testid="portfolio-selector-main">
      <label>Portfolio:</label>
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
            {selectedPortfolioData ? (
              <>
                <span
                  className="portfolio-color-dot"
                  style={{ backgroundColor: selectedPortfolioData.color }}
                />
                <span className="selected-text">{selectedPortfolioData.name}</span>
              </>
            ) : (
              <span className="placeholder-text">All Projects</span>
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
            {onManagePortfolios && (
              <div className="portfolio-dropdown-header">
                <span className="header-title">Portfolios</span>
                <button
                  className="portfolio-manage-btn"
                  onClick={handleManageClick}
                  title="Manage Portfolios"
                >
                  Manage
                </button>
              </div>
            )}
            <div className="portfolio-options-list">
              <div
                className={`portfolio-option-item all-projects-option ${!selectedPortfolio ? 'selected' : ''}`}
                onClick={() => handleSelect(null)}
                role="option"
                aria-selected={!selectedPortfolio}
              >
                <div className="option-content">
                  <span className="all-projects-icon">◆</span>
                  <span className="option-name">All Projects</span>
                </div>
              </div>
              {portfolios.map(portfolio => (
                <div
                  key={portfolio.id}
                  className={`portfolio-option-item ${
                    normalizedPortfolioId === portfolio.id ? 'selected' : ''
                  }`}
                  onClick={() => handleSelect(portfolio.id)}
                  role="option"
                  aria-selected={normalizedPortfolioId === portfolio.id}
                >
                  <div className="option-content">
                    <span
                      className="portfolio-color-dot-large"
                      style={{ backgroundColor: portfolio.color }}
                    />
                    <span className="option-name">{portfolio.name}</span>
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
