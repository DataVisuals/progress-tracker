import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { MdComment } from 'react-icons/md';
import { smallSelectStyles } from '../SelectStyles';
import ClarityIndicator from '../ClarityIndicator';
import 'react-quill/dist/quill.snow.css';

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 8) return `${diffWeeks}w ago`;
  return `${Math.floor(diffWeeks / 4)}mo ago`;
};

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
};

// Strip HTML tags to get plain text for clarity scoring
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

const CommentaryPanel = ({
  panelId,
  index,
  forDock,
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

  // Group comments by space or portfolio and order by recency
  const groupedComments = useMemo(() => {
    const groups = {};
    const groupBySpace = selectedSpace === 'all';

    // Only include root comments (no replies)
    const rootComments = filteredCommentary.filter(c => !c.parentCommentId);

    rootComments.forEach(item => {
      if (groupBySpace) {
        // Group by space
        const spaceKey = item.spaceId || 'none';
        if (!groups[spaceKey]) {
          groups[spaceKey] = {
            groupId: item.spaceId,
            groupName: item.spaceName || 'No Space',
            groupColor: null,
            items: []
          };
        }
        groups[spaceKey].items.push(item);
      } else {
        // Group by portfolio
        const portfolioKey = item.portfolioId || 'none';
        if (!groups[portfolioKey]) {
          groups[portfolioKey] = {
            groupId: item.portfolioId,
            groupName: item.portfolioName || 'No Portfolio',
            groupColor: item.portfolioColor,
            items: []
          };
        }
        groups[portfolioKey].items.push(item);
      }
    });

    // Sort items within each group by timestamp (most recent first)
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    // Sort groups: named groups first alphabetically, then "No Space/Portfolio"
    return Object.values(groups).sort((a, b) => {
      if (!a.groupId) return 1;
      if (!b.groupId) return -1;
      return a.groupName.localeCompare(b.groupName);
    });
  }, [filteredCommentary, selectedSpace]);

  // Create replies map for grouped comments
  const repliesMap = useMemo(() => {
    const replies = {};
    filteredCommentary.filter(c => c.parentCommentId).forEach(reply => {
      if (!replies[reply.parentCommentId]) {
        replies[reply.parentCommentId] = [];
      }
      replies[reply.parentCommentId].push(reply);
    });
    return replies;
  }, [filteredCommentary]);

  return (
    <div key={panelId} className={`home-quadrant commentary-quadrant ${forDock ? 'fullscreen-commentary' : ''} panel-${index + 1}`}>
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
            {groupedComments.map((group, groupIdx) => (
              <div key={groupIdx} className="commentary-group">
                <div className="commentary-group-header">
                  {group.groupColor && <span className="group-color-dot" style={{ backgroundColor: group.groupColor }} />}
                  <span className="group-name">{group.groupName}</span>
                  <span className="commentary-count">({group.items.length})</span>
                </div>
                {group.items.map((item, idx) => {
                  const replies = repliesMap[item.id] || [];
                  const isExpanded = expandedThreads[item.id];

                  return (
                    <div key={item.id || idx}>
                      <div className="commentary-item" onClick={() => onMetricClick(item.projectId, item.metricName)}>
                        <div className="commentary-item-left">
                          <div className="commentary-item-info">
                            <span className="commentary-item-name">
                              {item.projectName} · {item.metricName}
                            </span>
                            <div className="commentary-text ql-editor" dangerouslySetInnerHTML={{ __html: item.commentary }} />
                            <div className="commentary-item-meta">
                              <span className="commentary-item-period">{item.periodName}</span>
                              {item.createdBy && <span className="commentary-item-author">{item.createdBy}</span>}
                              <span className="commentary-item-time">{formatTimestamp(item.timestamp)}</span>
                            </div>
                          </div>
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
                              <div className="commentary-footer" style={{ marginTop: '2px' }}>
                                {reply.createdBy && <><span className="commentary-author">{reply.createdBy}</span><span style={{ color: '#9ca3af' }}>·</span></>}
                                <span className="commentary-time">{formatDateTime(reply.timestamp)}</span>
                                <span className="commentary-relative-time">({formatTimestamp(reply.timestamp)})</span>
                                <ClarityIndicator text={stripHtml(reply.commentary)} size="sm" compact />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentaryPanel;
