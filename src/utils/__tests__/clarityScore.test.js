import { describe, it, expect } from 'vitest';
import {
  calculateClarityScore,
  getClarityDescription,
  getClarityMethodology
} from '../clarityScore';

describe('clarityScore', () => {
  describe('calculateClarityScore', () => {
    describe('empty and minimal text', () => {
      it('should return score 1 for empty text', () => {
        const result = calculateClarityScore('');
        expect(result.score).toBe(1);
        expect(result.details.issues).toContain('No content');
      });

      it('should return score 1 for null text', () => {
        const result = calculateClarityScore(null);
        expect(result.score).toBe(1);
      });

      it('should return score 1 for undefined text', () => {
        const result = calculateClarityScore(undefined);
        expect(result.score).toBe(1);
      });

      it('should return score 1 for very short text', () => {
        const result = calculateClarityScore('Hi');
        expect(result.score).toBe(1);
        expect(result.details.issues).toContain('Too short - add more detail');
      });
    });

    describe('word count detection', () => {
      it('should count words correctly', () => {
        const result = calculateClarityScore('This is a test sentence with seven words.');
        expect(result.details.wordCount).toBe(8);
      });

      it('should handle multiple spaces between words', () => {
        const result = calculateClarityScore('This   has   extra   spaces.');
        expect(result.details.wordCount).toBe(4);
      });
    });

    describe('HTML stripping', () => {
      it('should strip HTML tags before scoring', () => {
        const result = calculateClarityScore('<p>This is <strong>formatted</strong> text.</p>');
        expect(result.details.wordCount).toBe(4);
      });

      it('should handle nested HTML tags', () => {
        const result = calculateClarityScore('<div><p><span>Test</span> content</p></div>');
        expect(result.details.wordCount).toBe(2);
      });
    });

    describe('jargon detection', () => {
      it('should detect business jargon', () => {
        const result = calculateClarityScore('We need to leverage synergy to disrupt the paradigm.');
        expect(result.details.jargonCount).toBeGreaterThan(0);
        expect(result.details.issues.some(i => i.toLowerCase().includes('jargon'))).toBe(true);
      });

      it('should not penalize clear language', () => {
        const result = calculateClarityScore('The project is on track. We expect to finish by end of month.');
        expect(result.details.jargonCount).toBe(0);
      });
    });

    describe('abbreviation detection', () => {
      it('should penalize unexplained abbreviations', () => {
        const result = calculateClarityScore('The XYZZY system needs updating. Please check the BLARG module.');
        expect(result.details.abbreviationCount).toBeGreaterThan(0);
      });

      it('should not penalize common abbreviations', () => {
        const result = calculateClarityScore('The CEO approved the Q1 budget. The API is working well.');
        expect(result.details.abbreviationCount).toBe(0);
      });

      it('should not penalize defined abbreviations', () => {
        const result = calculateClarityScore('The Project Management Office (PMO) approved the request. PMO will follow up.');
        expect(result.details.abbreviationCount).toBe(0);
      });

      it('should not penalize RAG as an abbreviation', () => {
        const result = calculateClarityScore('The project RAG status is green. RAG will be updated weekly.');
        expect(result.details.abbreviationCount).toBe(0);
      });

      it('should not penalize RED, AMBER, GREEN as abbreviations', () => {
        // These are common English words used in status contexts, not acronyms
        const result = calculateClarityScore('Status is RED due to resource issues. AMBER items need attention. GREEN items are on track.');
        expect(result.details.abbreviationCount).toBe(0);
        expect(result.details.issues.some(i => i.toLowerCase().includes('abbreviation'))).toBe(false);
      });

      it('should not penalize individual color words', () => {
        const redResult = calculateClarityScore('The status has been set to RED because we are blocked.');
        expect(redResult.details.abbreviationCount).toBe(0);

        const amberResult = calculateClarityScore('We moved the project to AMBER status pending review.');
        expect(amberResult.details.abbreviationCount).toBe(0);

        const greenResult = calculateClarityScore('Good news - the project is now GREEN and on track.');
        expect(greenResult.details.abbreviationCount).toBe(0);
      });

      it('should handle mixed RAG terminology', () => {
        const result = calculateClarityScore('The RAG status changed from RED to AMBER. We expect GREEN by next week.');
        expect(result.details.abbreviationCount).toBe(0);
      });

      it('should not penalize abbreviation defined with parentheses after', () => {
        const result = calculateClarityScore('The CRM (Customer Relationship Management) system is being upgraded. CRM will be offline.');
        expect(result.details.abbreviationCount).toBe(0);
      });

      it('should not penalize abbreviation defined with dash or colon', () => {
        const result = calculateClarityScore('ERP - Enterprise Resource Planning is being evaluated. ERP vendors were contacted.');
        expect(result.details.abbreviationCount).toBe(0);
      });
    });

    describe('sentence counting', () => {
      it('should count sentences correctly', () => {
        const result = calculateClarityScore('First sentence. Second sentence! Third sentence?');
        expect(result.details.sentenceCount).toBe(3);
      });
    });

    describe('score ranges', () => {
      it('should return score between 1 and 5', () => {
        const texts = [
          'Short',
          'This is a medium length sentence.',
          'This is a longer text with multiple sentences. It explains the project status clearly. The team is making good progress.'
        ];

        texts.forEach(text => {
          const result = calculateClarityScore(text);
          expect(result.score).toBeGreaterThanOrEqual(1);
          expect(result.score).toBeLessThanOrEqual(5);
        });
      });

      it('should give higher or equal scores to clear, well-structured text', () => {
        const clearText = 'The project is progressing well. We completed the design phase and are now in development. Expected completion is next month.';
        const jargonText = 'We need to leverage synergy and pivot to a holistic paradigm shift. Circle-back for deep-dive on deliverables.';

        const clearResult = calculateClarityScore(clearText);
        const jargonResult = calculateClarityScore(jargonText);

        // Clear text should score at least as well as jargon text
        expect(clearResult.score).toBeGreaterThanOrEqual(jargonResult.score);
        // Jargon text should have jargon detected in details
        expect(jargonResult.details.jargonCount).toBeGreaterThan(0);
      });
    });

    describe('content type differences', () => {
      it('should be stricter for descriptions', () => {
        const briefText = 'Status is good';

        const commentResult = calculateClarityScore(briefText, 'comment');
        const descriptionResult = calculateClarityScore(briefText, 'description');

        expect(commentResult.score).toBeGreaterThanOrEqual(descriptionResult.score);
      });

      it('should reward more detailed descriptions', () => {
        const detailedText = 'This project focuses on improving the user experience of the dashboard. We are implementing new charts, filters, and export functionality. The team consists of three developers and one designer.';

        const result = calculateClarityScore(detailedText, 'description');
        expect(result.score).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Flesch-Kincaid calculation', () => {
      it('should calculate grade level for longer text', () => {
        const text = 'This is a simple sentence. It has easy words. The meaning is clear. Anyone can read this text.';
        const result = calculateClarityScore(text);

        expect(result.details.fleschKincaid).not.toBeNull();
        expect(result.details.fleschKincaid).toBeGreaterThanOrEqual(0);
      });

      it('should return null or undefined for very short text', () => {
        const result = calculateClarityScore('Hi there');
        // Very short text doesn't have Flesch-Kincaid calculated
        expect([null, undefined]).toContain(result.details.fleschKincaid);
      });
    });
  });

  describe('getClarityDescription', () => {
    it('should return appropriate descriptions for each score level', () => {
      expect(getClarityDescription(5)).toContain('Excellent');
      expect(getClarityDescription(4)).toContain('Good');
      expect(getClarityDescription(3)).toContain('Average');
      expect(getClarityDescription(2)).toContain('Below average');
      expect(getClarityDescription(1)).toContain('Poor');
    });

    it('should handle invalid scores', () => {
      expect(getClarityDescription(0)).toBe('Not rated');
      expect(getClarityDescription(6)).toBe('Not rated');
    });

    it('should provide context-aware descriptions for brief content', () => {
      const details = { wordCount: 5 };
      expect(getClarityDescription(3, details)).toContain('Add more detail');
    });
  });

  describe('getClarityMethodology', () => {
    it('should return methodology explanation', () => {
      const methodology = getClarityMethodology();
      expect(methodology).toContain('Clarity Score');
      expect(methodology).toContain('LENGTH');
      expect(methodology).toContain('READABILITY');
      expect(methodology).toContain('PLAIN LANGUAGE');
      expect(methodology).toContain('ABBREVIATIONS');
    });

    it('should adjust targets for description content type', () => {
      const commentMethodology = getClarityMethodology('comment');
      const descriptionMethodology = getClarityMethodology('description');

      expect(commentMethodology).toContain('5-150');
      expect(descriptionMethodology).toContain('30-150');
    });
  });
});
