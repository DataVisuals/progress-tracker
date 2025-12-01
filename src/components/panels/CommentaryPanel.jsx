import React, { useMemo } from 'react';
import Select from 'react-select';
import { MdComment } from 'react-icons/md';
import { smallSelectStyles } from '../SelectStyles';
import 'react-quill/dist/quill.snow.css';

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const CommentaryPanel = ({
  panelId,
  index,
  darkMode,
  loading,
  recentCommentary,
  commentaryPortfolioFilter,
  setCommentaryPortfolioFilter,
  selectedSpace,
  spaces,
  onMetricClick
}) => {
  // Get unique portfolios from commentary for filter dropdown
  const portfoliosInCommentary = useMemo(() => {
    const portfolioMap = new Map();
    recentCommentary.forEach(comment => {
      if (comment.portfolioId && !portfolioMap.has(comment.portfolioId)) {
        portfolioMap.set(comment.portfolioId, {
          id: comment.portfolioId,
          name: comment.portfolioName,
          color: comment.portfolioColor
        });
      }
    });
    return Array.from(portfolioMap.values());
  }, [recentCommentary]);

  // Filter commentary based on portfolio filter
  const filteredCommentary = commentaryPortfolioFilter === 'all'
    ? recentCommentary
    : recentCommentary.filter(c => c.portfolioId === parseInt(commentaryPortfolioFilter));

  return (
    <div key={panelId} className={`home-quadrant commentary-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdComment className="quadrant-icon" />
        <h2>Recent Commentary</h2>
        {portfoliosInCommentary.length > 1 && (
          <Select
            key={`commentary-portfolio-${darkMode}`}
            className="portfolio-filter-dropdown"
            styles={smallSelectStyles}
            value={commentaryPortfolioFilter === 'all'
              ? { value: 'all', label: 'All Portfolios' }
              : portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter))
                ? { value: portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter)).id, label: portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter)).name }
                : { value: 'all', label: 'All Portfolios' }}
            onChange={(option) => setCommentaryPortfolioFilter(option.value.toString())}
            options={[{ value: 'all', label: 'All Portfolios' }, ...portfoliosInCommentary.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))]}
            menuPortalTarget={document.body}
            isSearchable={false}
          />
        )}
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : filteredCommentary.length === 0 ? (
          <div className="empty-state">
            <MdComment className="empty-icon" />
            <p>No recent commentary</p>
            <span>No commentary for {commentaryPortfolioFilter === 'all'
              ? (selectedSpace === 'all'
                ? 'All Spaces'
                : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space')
              : portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter))?.name || 'selected portfolio'}</span>
          </div>
        ) : (
          <div className="commentary-list">
            {filteredCommentary.map((item, idx) => {
              const showPortfolioHeader = idx === 0 || item.portfolioName !== filteredCommentary[idx - 1].portfolioName;
              return (
                <React.Fragment key={idx}>
                  {showPortfolioHeader && (
                    <div className="portfolio-group-header">
                      {item.portfolioColor && <span className="portfolio-header-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                      <span className="portfolio-header-name">{item.portfolioName || 'No Portfolio'}</span>
                    </div>
                  )}
                  <div className="commentary-item" onClick={() => onMetricClick(item.projectId, item.metricName)}>
                    <div className="commentary-header">
                      <div className="commentary-context">
                        {item.portfolioColor && <span className="commentary-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                        <span className="commentary-label">Project:</span>
                        <span className="commentary-project">{item.projectName}</span>
                      </div>
                      <div className="commentary-context">
                        <span className="commentary-label">Metric:</span>
                        <span className="commentary-metric">{item.metricName}</span>
                      </div>
                      <div className="commentary-context">
                        <span className="commentary-label">Period:</span>
                        <span className="commentary-period">{item.periodName}</span>
                      </div>
                    </div>
                    <div className="commentary-text ql-editor" dangerouslySetInnerHTML={{ __html: item.commentary }} />
                    <div className="commentary-footer">
                      {item.createdBy && <span className="commentary-author">{item.createdBy}</span>}
                      <span className="commentary-time">{formatTimestamp(item.timestamp)}</span>
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

export default CommentaryPanel;
