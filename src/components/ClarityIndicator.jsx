import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { calculateClarityScore, getClarityDescription, getClarityMethodology } from '../utils/clarityScore';
import './ClarityIndicator.css';

/**
 * Diamond icon - wide brilliant-cut design
 */
const GemIcon = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`gem-icon ${className}`}
  >
    {/* Crown - top triangle */}
    <path d="M12 3L4 8H20L12 3Z" opacity="0.95" />
    {/* Girdle - horizontal band */}
    <path d="M4 8L6 10H18L20 8H4Z" opacity="0.8" />
    {/* Pavilion facets */}
    <path d="M6 10L12 21L9 10H6Z" opacity="0.7" />
    <path d="M9 10L12 21L12 10H9Z" opacity="0.6" />
    <path d="M12 10L12 21L15 10H12Z" opacity="0.5" />
    <path d="M15 10L12 21L18 10H15Z" opacity="0.4" />
    {/* Outline */}
    <path
      d="M12 3L4 8L6 10L12 21L18 10L20 8L12 3Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeOpacity="0.4"
    />
    {/* Sparkle highlight */}
    <path d="M10 5.5L12 4L14 5.5L12 6.5L10 5.5Z" fill="white" opacity="0.35" />
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
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, flipLeft: false });
  const indicatorRef = useRef(null);
  const { score, details } = calculateClarityScore(text, contentType);

  // Calculate tooltip position when hovered, flip to left if would go off-screen
  useEffect(() => {
    if (isHovered && indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect();
      const tooltipWidth = compact ? 280 : 320;
      const wouldOverflowRight = rect.right + 10 + tooltipWidth > window.innerWidth;

      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: wouldOverflowRight ? rect.left - 10 : rect.right + 10,
        flipLeft: wouldOverflowRight
      });
    }
  }, [isHovered, compact]);

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

  // Render tooltip content
  const renderTooltip = () => {
    if (!showTooltip || !isHovered) return null;

    const tooltipContent = (
      <div
        className={`clarity-tooltip clarity-tooltip-portal${compact ? ' clarity-tooltip-compact' : ''}${tooltipPos.flipLeft ? ' clarity-tooltip-left' : ''}`}
        style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.flipLeft ? 'auto' : tooltipPos.left,
          right: tooltipPos.flipLeft ? window.innerWidth - tooltipPos.left : 'auto',
          transform: 'translateY(-50%)'
        }}
      >
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

        {!compact && (
          <div className="clarity-methodology">
            <details>
              <summary>How is this calculated?</summary>
              <pre>{getClarityMethodology(contentType)}</pre>
            </details>
          </div>
        )}
      </div>
    );

    return createPortal(tooltipContent, document.body);
  };

  return (
    <div
      ref={indicatorRef}
      className={`clarity-indicator ${getScoreClass(score)} size-${size}${hoverReveal ? ' hover-reveal' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GemIcon size={iconSize} />
      {!compact && <span className="clarity-score-number">{score}</span>}
      {renderTooltip()}
    </div>
  );
};

export default ClarityIndicator;
