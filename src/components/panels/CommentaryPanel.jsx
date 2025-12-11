import React, { useMemo, useState } from 'react';
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

  // State for expanded comment threads
  const [expandedThreads, setExpandedThreads] = useState({});

  const toggleThread = (commentId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // Group comments: root comments and their replies
  const { rootComments, repliesMap } = useMemo(() => {
    const roots = filteredCommentary.filter(c => !c.parentCommentId);
    const replies = {};
    filteredCommentary.filter(c => c.parentCommentId).forEach(reply => {
      if (!replies[reply.parentCommentId]) {
        replies[reply.parentCommentId] = [];
      }
      replies[reply.parentCommentId].push(reply);
    });
    return { rootComments: roots, repliesMap: replies };
  }, [filteredCommentary]);

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
          <div className="commentary-list" style={{ gap: '2px' }}>
            {rootComments.map((item, idx) => {
              const replies = repliesMap[item.id] || [];
              const isExpanded = expandedThreads[item.id];

              return (
                <div key={item.id || idx}>
                  <div className="commentary-item" onClick={() => onMetricClick(item.projectId, item.metricName)} style={{ padding: '6px 8px' }}>
                    <div className="commentary-header" style={{ gap: '4px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <div className="commentary-context" style={{ fontSize: '11px' }}>
                        {item.portfolioColor && <span className="commentary-portfolio-dot" style={{ backgroundColor: item.portfolioColor, width: '6px', height: '6px' }} title={item.portfolioName || 'No Portfolio'} />}
                        <span className="commentary-project" style={{ fontWeight: 500 }}>{item.projectName}</span>
                        <span style={{ color: '#9ca3af' }}>·</span>
                        <span className="commentary-metric">{item.metricName}</span>
                        <span style={{ color: '#9ca3af' }}>·</span>
                        <span className="commentary-period" style={{ color: '#6b7280' }}>{item.periodName}</span>
                      </div>
                    </div>
                    <div className="commentary-text ql-editor" style={{ fontSize: '12px', lineHeight: '1.4', padding: '0', margin: '0' }} dangerouslySetInnerHTML={{ __html: item.commentary }} />
                    <div className="commentary-footer" style={{ fontSize: '10px', marginTop: '2px', gap: '6px' }}>
                      {item.createdBy && <span className="commentary-author">{item.createdBy}</span>}
                      <span className="commentary-time">{formatTimestamp(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Show replies toggle and collapsed replies */}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleThread(item.id); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '10px',
                          color: '#6b7280',
                          padding: '3px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '8px' }}>▶</span>
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                      </button>

                      {isExpanded && replies.map((reply, replyIdx) => (
                        <div
                          key={reply.id || replyIdx}
                          className="commentary-item reply"
                          onClick={() => onMetricClick(reply.projectId, reply.metricName)}
                          style={{ backgroundColor: '#fafafa', marginLeft: '4px', padding: '4px 8px' }}
                        >
                          <div className="commentary-text ql-editor" style={{ fontSize: '11px', lineHeight: '1.3', padding: '0', margin: '0' }} dangerouslySetInnerHTML={{ __html: reply.commentary }} />
                          <div className="commentary-footer" style={{ fontSize: '9px', marginTop: '2px' }}>
                            {reply.createdBy && <span className="commentary-author">{reply.createdBy}</span>}
                            <span className="commentary-time">{formatTimestamp(reply.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentaryPanel;
