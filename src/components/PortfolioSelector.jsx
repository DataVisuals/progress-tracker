import React from 'react';
import './PortfolioSelector.css';

export default function PortfolioSelector({
  portfolios,
  selectedPortfolio,
  onPortfolioChange,
  onManagePortfolios
}) {
  const handleChange = (e) => {
    const value = e.target.value;

    if (value === '__manage__') {
      // Trigger manage portfolios
      if (onManagePortfolios) {
        onManagePortfolios();
      }
      // Don't change the selection
      return;
    }

    onPortfolioChange(value || null);
  };

  return (
    <div className="portfolio-selector">
      <label>Portfolio:</label>
      <select
        value={selectedPortfolio || ''}
        onChange={handleChange}
        className="portfolio-select"
      >
        <option value="">All Projects</option>
        {portfolios.map(portfolio => (
          <option key={portfolio.id} value={portfolio.id}>
            {portfolio.name}
          </option>
        ))}
        {onManagePortfolios && (
          <>
            <option disabled>─────────────</option>
            <option value="__manage__">⚙️ Manage Portfolios...</option>
          </>
        )}
      </select>
    </div>
  );
}
