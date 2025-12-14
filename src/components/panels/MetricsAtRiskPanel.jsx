import React from 'react';
import Select from 'react-select';
import { MdPriorityHigh, MdTrendingUp, MdArrowForward, MdErrorOutline } from 'react-icons/md';
import { smallSelectStyles } from '../SelectStyles';

const MetricsAtRiskPanel = ({
  panelId,
  index,
  darkMode,
  loading,
  forDock,
  atRiskMetrics,
  filteredMetrics,
  ragFilter,
  setRagFilter,
  redCount,
  amberCount,
  portfolioFilter,
  setPortfolioFilter,
  portfoliosInMetrics,
  selectedSpace,
  spaces,
  needsRecoveryPlan,
  onMetricClick
}) => {
  // Calculate variance percentage (how far behind)
  const getVariance = (actual, expected) => {
    if (expected === 0) return 0;
    return Math.round(((expected - actual) / expected) * 100);
  };

  // Render the stats text for a metric
  const renderMetricStats = (item) => {
    const variance = getVariance(item.complete, item.expected);
    return (
      <div className="metric-stats">
        <span className="stat-actual">{Number(item.complete).toFixed(2)}</span>
        <span className="stat-separator">of</span>
        <span className="stat-expected">{Number(item.expected).toFixed(2)}</span>
        <span className="stat-separator">expected</span>
        <span className="stat-divider">·</span>
        <span className="stat-target">{Number(item.target).toFixed(2)}</span>
        <span className="stat-separator">target</span>
        <span className={`stat-variance ${item.ragStatus}`}>({variance}% behind)</span>
      </div>
    );
  };

  return (
    <div key={panelId} className={`home-quadrant metrics-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdPriorityHigh className="quadrant-icon warning" />
        <h2>Metrics at Risk</h2>
        <div className="filter-controls">
          <div className="rag-filter-buttons">
            <button className={`rag-filter-btn ${ragFilter === 'all' ? 'active' : ''}`} onClick={() => setRagFilter('all')}>All ({atRiskMetrics.length})</button>
            <button className={`rag-filter-btn red ${ragFilter === 'red' ? 'active' : ''}`} onClick={() => setRagFilter('red')}>Red ({redCount})</button>
            <button className={`rag-filter-btn amber ${ragFilter === 'amber' ? 'active' : ''}`} onClick={() => setRagFilter('amber')}>Amber ({amberCount})</button>
          </div>
          {portfoliosInMetrics.length > 1 && (
            <Select
              key={`metrics-portfolio-${darkMode}`}
              className="portfolio-filter-dropdown"
              styles={smallSelectStyles}
              value={portfolioFilter === 'all' ? { value: 'all', label: 'All Portfolios' } : portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)) ? { value: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).id, label: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).name } : { value: 'all', label: 'All Portfolios' }}
              onChange={(option) => setPortfolioFilter(option.value.toString())}
              options={[{ value: 'all', label: 'All Portfolios' }, ...portfoliosInMetrics.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))]}
              isSearchable={false}
            />
          )}
        </div>
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : atRiskMetrics.length === 0 ? (
          <div className="empty-state success">
            <MdTrendingUp className="empty-icon" />
            <p>All metrics on track!</p>
            <span>No metrics at risk for {selectedSpace === 'all' ? 'All Spaces' : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space'}</span>
          </div>
        ) : filteredMetrics.length === 0 ? (
          <div className="empty-state success">
            <MdTrendingUp className="empty-icon" />
            <p>No {ragFilter === 'all' ? 'at-risk' : ragFilter} metrics!</p>
            <span>No {ragFilter === 'all' ? 'at-risk' : ragFilter} metrics for {portfolioFilter === 'all' ? (selectedSpace === 'all' ? 'All Spaces' : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space') : portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter))?.name || 'selected portfolio'}</span>
          </div>
        ) : forDock ? (
          // Fullscreen view: 2 columns for red and amber
          <div className="metrics-columns-container">
            <div className="metrics-column red-column">
              <div className="column-header red">
                <span className="column-status-dot red" />
                <h3>Red ({filteredMetrics.filter(m => m.ragStatus === 'red').length})</h3>
              </div>
              <div className="metrics-list">
                {filteredMetrics.filter(m => m.ragStatus === 'red').map((item, idx) => (
                  <div key={idx} className={`metric-item ${item.ragStatus}`} onClick={() => onMetricClick(item.projectId, item.metricName)}>
                    <div className="metric-left">
                      <div className="metric-header">
                        {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                        <div className="metric-text">
                          <span className="metric-project">{item.projectName}</span>
                          <span className="metric-name">{item.metricName}{item.hasActualValue && needsRecoveryPlan(item.metricId) && <MdErrorOutline className="recovery-plan-indicator" title="Recovery Plan Required" />}</span>
                        </div>
                      </div>
                    </div>
                    <div className="metric-right">
                      {renderMetricStats(item)}
                      <MdArrowForward className="metric-arrow" />
                    </div>
                  </div>
                ))}
                {filteredMetrics.filter(m => m.ragStatus === 'red').length === 0 && (
                  <div className="empty-column">No red metrics</div>
                )}
              </div>
            </div>
            <div className="metrics-column amber-column">
              <div className="column-header amber">
                <span className="column-status-dot amber" />
                <h3>Amber ({filteredMetrics.filter(m => m.ragStatus === 'amber').length})</h3>
              </div>
              <div className="metrics-list">
                {filteredMetrics.filter(m => m.ragStatus === 'amber').map((item, idx) => (
                  <div key={idx} className={`metric-item ${item.ragStatus}`} onClick={() => onMetricClick(item.projectId, item.metricName)}>
                    <div className="metric-left">
                      <div className="metric-header">
                        {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                        <div className="metric-text">
                          <span className="metric-project">{item.projectName}</span>
                          <span className="metric-name">{item.metricName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="metric-right">
                      {renderMetricStats(item)}
                      <MdArrowForward className="metric-arrow" />
                    </div>
                  </div>
                ))}
                {filteredMetrics.filter(m => m.ragStatus === 'amber').length === 0 && (
                  <div className="empty-column">No amber metrics</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Normal view: single list
          <div className="metrics-list">
            {filteredMetrics.map((item, idx) => {
              const showPortfolioHeader = idx === 0 || item.portfolioName !== filteredMetrics[idx - 1].portfolioName;
              return (
                <React.Fragment key={idx}>
                  {showPortfolioHeader && (
                    <div className="portfolio-group-header">
                      {item.portfolioColor && <span className="portfolio-header-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                      <span className="portfolio-header-name">{item.portfolioName || 'No Portfolio'}</span>
                    </div>
                  )}
                  <div className={`metric-item ${item.ragStatus}`} onClick={() => onMetricClick(item.projectId, item.metricName)}>
                    <div className="metric-left">
                      <div className="metric-header">
                        {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                        <div className="metric-text">
                          <span className="metric-project">{item.projectName}</span>
                          <span className="metric-name">{item.metricName}{item.ragStatus === 'red' && item.hasActualValue && needsRecoveryPlan(item.metricId) && <MdErrorOutline className="recovery-plan-indicator" title="Recovery Plan Required" />}</span>
                        </div>
                      </div>
                    </div>
                    <div className="metric-right">
                      {renderMetricStats(item)}
                      <MdArrowForward className="metric-arrow" />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsAtRiskPanel;
