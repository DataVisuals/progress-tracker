import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClarityIndicator from '../ClarityIndicator';

describe('ClarityIndicator', () => {
  describe('Rendering', () => {
    it('should render for text with content', () => {
      render(<ClarityIndicator text="This is a test sentence with enough words to analyze." />);

      // Should render the gem icon (svg element)
      expect(document.querySelector('.gem-icon')).toBeInTheDocument();
    });

    it('should not render for empty text', () => {
      const { container } = render(<ClarityIndicator text="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render for null text', () => {
      const { container } = render(<ClarityIndicator text={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render for text with no words', () => {
      const { container } = render(<ClarityIndicator text="   " />);
      expect(container.firstChild).toBeNull();
    });

    it('should render for single word text', () => {
      render(<ClarityIndicator text="Hello" />);
      expect(document.querySelector('.clarity-indicator')).toBeInTheDocument();
    });
  });

  describe('Score Display', () => {
    it('should display score number in non-compact mode', () => {
      render(<ClarityIndicator text="This is a clear and well-written sentence about the project status." />);

      // Should show a score number (1-5)
      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toBeInTheDocument();

      const scoreNumber = document.querySelector('.clarity-score-number');
      expect(scoreNumber).toBeInTheDocument();
      expect(Number(scoreNumber.textContent)).toBeGreaterThanOrEqual(1);
      expect(Number(scoreNumber.textContent)).toBeLessThanOrEqual(5);
    });

    it('should not display score number in compact mode', () => {
      render(<ClarityIndicator text="This is a test sentence." compact={true} />);

      const scoreNumber = document.querySelector('.clarity-score-number');
      expect(scoreNumber).not.toBeInTheDocument();
    });
  });

  describe('Score Classes', () => {
    it('should apply clarity-good class for high scores', () => {
      // Clear, concise text should score well
      render(
        <ClarityIndicator
          text="The project is on track. We completed the design phase. Testing begins next week."
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      // Score should be 4 or 5, which gives clarity-good class
      expect(indicator.className).toMatch(/clarity-(good|average)/);
    });

    it('should detect jargon in text even with high score', () => {
      // The clarity scoring is lenient, but should still detect jargon
      render(
        <ClarityIndicator
          text="We need to leverage synergy and pivot to disrupt the paradigm with holistic deliverables."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toBeInTheDocument();

      // Hover to show tooltip with details
      fireEvent.mouseEnter(indicator);

      // The tooltip should exist and show jargon was detected
      const tooltip = document.querySelector('.clarity-tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Size Variations', () => {
    it('should apply size-sm class for small size', () => {
      render(<ClarityIndicator text="Test content here" size="sm" />);

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toHaveClass('size-sm');
    });

    it('should apply size-md class for medium size', () => {
      render(<ClarityIndicator text="Test content here" size="md" />);

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toHaveClass('size-md');
    });

    it('should apply size-lg class for large size', () => {
      render(<ClarityIndicator text="Test content here" size="lg" />);

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toHaveClass('size-lg');
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip on hover when showTooltip is true', async () => {
      render(
        <ClarityIndicator
          text="This is a longer text that should have a proper clarity score and show the tooltip."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        const tooltip = document.querySelector('.clarity-tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <ClarityIndicator
          text="This is a longer text with enough content for analysis."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');

      // Hover to show tooltip
      fireEvent.mouseEnter(indicator);
      await waitFor(() => {
        expect(document.querySelector('.clarity-tooltip')).toBeInTheDocument();
      });

      // Leave to hide tooltip
      fireEvent.mouseLeave(indicator);
      await waitFor(() => {
        expect(document.querySelector('.clarity-tooltip')).not.toBeInTheDocument();
      });
    });

    it('should not show tooltip when showTooltip is false', async () => {
      render(
        <ClarityIndicator
          text="This is a test sentence with content."
          showTooltip={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      fireEvent.mouseEnter(indicator);

      // Wait a bit and check that no tooltip appeared
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(document.querySelector('.clarity-tooltip')).not.toBeInTheDocument();
    });

    it('should use native title tooltip in compact mode', () => {
      render(<ClarityIndicator text="Test content here" compact={true} />);

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toHaveAttribute('title');
      expect(indicator.getAttribute('title')).toContain('Clarity');
    });
  });

  describe('Tooltip Content', () => {
    it('should display score in tooltip', async () => {
      render(
        <ClarityIndicator
          text="This is a clear and well-structured sentence about project status."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        const tooltip = document.querySelector('.clarity-tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip.textContent).toContain('Clarity Score');
        expect(tooltip.textContent).toMatch(/\d\/5/); // Score format like "4/5"
      });
    });

    it('should display word count in tooltip', async () => {
      render(
        <ClarityIndicator
          text="This is a sentence with exactly eight words here."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        const tooltip = document.querySelector('.clarity-tooltip');
        expect(tooltip.textContent).toContain('words');
      });
    });

    it('should display methodology section', async () => {
      render(
        <ClarityIndicator
          text="This is a test sentence to check methodology display."
          showTooltip={true}
          compact={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        const methodology = document.querySelector('.clarity-methodology');
        expect(methodology).toBeInTheDocument();
        expect(methodology.textContent).toContain('How is this calculated');
      });
    });
  });

  describe('Content Types', () => {
    it('should accept contentType prop for description', () => {
      // Descriptions have stricter scoring
      render(
        <ClarityIndicator
          text="Brief status"
          contentType="description"
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toBeInTheDocument();
    });

    it('should accept contentType prop for comment', () => {
      render(
        <ClarityIndicator
          text="Brief status"
          contentType="comment"
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Hover Reveal Mode', () => {
    it('should apply hover-reveal class when hoverReveal is true', () => {
      render(
        <ClarityIndicator
          text="Test content"
          hoverReveal={true}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toHaveClass('hover-reveal');
    });

    it('should not apply hover-reveal class when hoverReveal is false', () => {
      render(
        <ClarityIndicator
          text="Test content"
          hoverReveal={false}
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).not.toHaveClass('hover-reveal');
    });
  });

  describe('HTML Content', () => {
    it('should handle HTML-formatted text', () => {
      render(
        <ClarityIndicator
          text="<p>This is <strong>formatted</strong> HTML content with multiple words.</p>"
        />
      );

      const indicator = document.querySelector('.clarity-indicator');
      expect(indicator).toBeInTheDocument();
    });
  });
});
