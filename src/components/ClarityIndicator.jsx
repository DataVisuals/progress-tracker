import React, { useState } from 'react';
import { calculateClarityScore, getClarityDescription, getClarityMethodology } from '../utils/clarityScore';
import './ClarityIndicator.css';

/**
 * Gem/Crystal icon - faceted gemstone design
 */
const GemIcon = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`gem-icon ${className}`}
  >
    {/* Top facets */}
    <path d="M12 2L4 8L12 10L20 8L12 2Z" opacity="0.9" />
    {/* Left facet */}
    <path d="M4 8L12 10L12 22L4 8Z" opacity="0.7" />
    {/* Right facet */}
    <path d="M20 8L12 10L12 22L20 8Z" opacity="0.5" />
    {/* Outline */}
    <path
      d="M12 2L4 8L12 22L20 8L12 2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.3"
    />
    {/* Center highlight */}
    <path d="M12 10L4 8L20 8L12 10Z" fill="white" opacity="0.2" />
  </svg>
);

/**
 * ClarityIndicator - Shows a single color-coded gem based on text clarity
 *
 * @param {string} text - The text to analyze (can be HTML)
 * @param {boolean} showTooltip - Whether to show methodology tooltip on hover
 * @param {string} size - Size of icon: 'sm', 'md', 'lg'
 * @param {boolean} compact - If true, only shows icon without score number
 * @param {string} contentType - 'description' (stricter) or 'comment' (default)
 */
const ClarityIndicator = ({ text, showTooltip = true, size = 'md', compact = false, hoverReveal = false, contentType = 'comment' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { score, details } = calculateClarityScore(text, contentType);

  const sizeMap = {
    sm: 14,
    md: 18,
    lg: 22
  };

  const iconSize = sizeMap[size] || 18;

  // Don't show if no text at all (show from 1+ words)
  if (!text || details.wordCount < 1) {
    return null;
  }

  const getScoreClass = (score) => {
    if (score >= 4) return 'clarity-good';
    if (score >= 3) return 'clarity-average';
    return 'clarity-poor';
  };

  // For compact mode, use native title tooltip to avoid clipping issues
  const nativeTooltip = compact || !showTooltip
    ? `Clarity: ${score}/5 - ${getClarityDescription(score, details)}${details.issues.length > 0 ? '\n\nSuggestions:\n• ' + details.issues.join('\n• ') : ''}`
    : undefined;

  return (
    <div
      className={`clarity-indicator ${getScoreClass(score)} size-${size}${hoverReveal ? ' hover-reveal' : ''}`}
      onMouseEnter={() => !compact && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={nativeTooltip}
    >
      <GemIcon size={iconSize} />
      {!compact && <span className="clarity-score-number">{score}</span>}

      {showTooltip && !compact && isHovered && (
        <div className="clarity-tooltip">
          <div className="clarity-tooltip-header">
            <span className="clarity-score-label">Clarity Score: {score}/5</span>
            <span className="clarity-description">{getClarityDescription(score, details)}</span>
          </div>

          {details.issues.length > 0 && (
            <div className="clarity-issues">
              <span className="issues-label">Suggestions:</span>
              <ul>
                {details.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="clarity-stats">
            <span>{details.wordCount} words</span>
            <span>•</span>
            <span>{details.sentenceCount} sentence{details.sentenceCount !== 1 ? 's' : ''}</span>
            {details.fleschKincaid !== null && (
              <>
                <span>•</span>
                <span>Grade {details.fleschKincaid}</span>
              </>
            )}
          </div>

          <div className="clarity-methodology">
            <details>
              <summary>How is this calculated?</summary>
              <pre>{getClarityMethodology(contentType)}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClarityIndicator;
