import React, { useState, useEffect, useMemo } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import { api } from '../../api/client';
import { calculateClarityScore } from '../../utils/clarityScore';
import './ClarityPanel.css';

/**
 * Gem/Crystal icon for clarity scores
 */
const GemIcon = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`gem-icon ${className}`}
  >
    <path d="M12 2L4 8L12 10L20 8L12 2Z" opacity="0.9" />
    <path d="M4 8L12 10L12 22L4 8Z" opacity="0.7" />
    <path d="M20 8L12 10L12 22L20 8Z" opacity="0.5" />
    <path
      d="M12 2L4 8L12 22L20 8L12 2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.3"
    />
    <path d="M12 10L4 8L20 8L12 10Z" fill="white" opacity="0.2" />
  </svg>
);

const getScoreClass = (score) => {
  if (score >= 4) return 'clarity-good';
  if (score >= 3) return 'clarity-average';
  return 'clarity-poor';
};

const ClarityPanel = ({
  panelId,
  index,
  forDock
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await api.getCommentsByUser();
      setComments(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load clarity data:', err);
      console.error('Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate average clarity score per user
  const userRankings = useMemo(() => {
    if (!comments || comments.length === 0) return [];

    // Group comments by user
    const userComments = {};
    comments.forEach(comment => {
      if (!comment.created_by) return;
      if (!userComments[comment.created_by]) {
        userComments[comment.created_by] = {
          userId: comment.created_by,
          userName: comment.user_name || 'Unknown',
          userEmail: comment.user_email,
          comments: [],
          totalScore: 0,
          commentCount: 0
        };
      }
      const { score } = calculateClarityScore(comment.comment_text, 'comment');
      userComments[comment.created_by].comments.push({
        text: comment.comment_text,
        score
      });
      userComments[comment.created_by].totalScore += score;
      userComments[comment.created_by].commentCount++;
    });

    // Calculate average score and sort
    const rankings = Object.values(userComments)
      .filter(u => u.commentCount >= 1) // Only include users with at least 1 comment
      .map(u => ({
        ...u,
        avgScore: Math.round((u.totalScore / u.commentCount) * 10) / 10
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return rankings;
  }, [comments]);

  const top10 = userRankings.slice(0, 10);
  const bottom10 = [...userRankings].reverse().slice(0, 10);

  // Calculate averages for each group
  const top10Avg = top10.length > 0
    ? Math.round((top10.reduce((sum, u) => sum + u.avgScore, 0) / top10.length) * 10) / 10
    : 0;
  const bottom10Avg = bottom10.length > 0
    ? Math.round((bottom10.reduce((sum, u) => sum + u.avgScore, 0) / bottom10.length) * 10) / 10
    : 0;

  const renderUserItem = (user, rank, isTop) => (
    <div key={user.userId} className={`clarity-ranking-item ${isTop ? 'top' : 'bottom'}`}>
      <span className="clarity-rank">{rank}</span>
      <div className={`clarity-crystal ${getScoreClass(user.avgScore)}`}>
        <GemIcon size={20} />
      </div>
      <div className="clarity-user-info">
        <span className="clarity-user-name">{user.userName}</span>
        <span className="clarity-comment-count">{user.commentCount} comment{user.commentCount !== 1 ? 's' : ''}</span>
      </div>
      <div className={`clarity-score-value ${getScoreClass(user.avgScore)}`}>
        {user.avgScore.toFixed(1)}
      </div>
    </div>
  );

  // Render content
  const renderContent = () => {
    if (loading) {
      return <div className="clarity-loading">Loading clarity data...</div>;
    }

    if (error) {
      return <div className="clarity-error">{error}</div>;
    }

    if (userRankings.length === 0) {
      return <div className="empty-quadrant"><p>No comment data available</p></div>;
    }

    return (
      <div className={`clarity-rankings-container ${forDock ? 'fullscreen' : ''}`}>
        <div className="clarity-column">
          <div className="clarity-column-header top">
            <span className="clarity-header-title">Top 10 Clearest Writers</span>
            <div className="clarity-avg-badge top">
              <GemIcon size={14} />
              <span>Avg: {top10Avg.toFixed(1)}</span>
            </div>
          </div>
          <div className="clarity-list">
            {top10.map((user, idx) => renderUserItem(user, idx + 1, true))}
          </div>
        </div>
        <div className="clarity-column">
          <div className="clarity-column-header bottom">
            <span className="clarity-header-title">Bottom 10 - Needs Improvement</span>
            <div className="clarity-avg-badge bottom">
              <GemIcon size={14} />
              <span>Avg: {bottom10Avg.toFixed(1)}</span>
            </div>
          </div>
          <div className="clarity-list">
            {bottom10.map((user, idx) => renderUserItem(user, userRankings.length - idx, false))}
          </div>
        </div>
      </div>
    );
  };

  // Fullscreen/dock view
  if (forDock) {
    return (
      <div key={panelId} className={`home-quadrant clarity-quadrant fullscreen-clarity panel-${index + 1}`}>
        <div className="quadrant-content">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Regular panel view
  return (
    <div key={panelId} className={`home-quadrant clarity-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdAutoAwesome className="quadrant-icon" />
        <h2>Clarity Rankings</h2>
      </div>
      <div className="quadrant-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default ClarityPanel;
