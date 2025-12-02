/**
 * Clarity Score Calculator
 *
 * Evaluates text clarity on a scale of 1-5 based on:
 * - Conciseness (shorter sentences are better)
 * - Jargon/abbreviation usage (penalized)
 * - Overall length (very long text is penalized)
 * - Readability factors
 */

// Common business jargon and buzzwords to penalize
const JARGON_WORDS = [
  'synergy', 'leverage', 'paradigm', 'bandwidth', 'holistic', 'proactive',
  'ecosystem', 'streamline', 'stakeholder', 'deliverable', 'actionable',
  'scalable', 'granular', 'robust', 'seamless', 'agile', 'pivot',
  'disrupt', 'ideate', 'incentivize', 'onboard', 'offboard', 'upskill',
  'deep-dive', 'drill-down', 'circle-back', 'touch-base', 'move-the-needle',
  'low-hanging-fruit', 'game-changer', 'best-in-class', 'world-class',
  'cutting-edge', 'bleeding-edge', 'thought-leader', 'value-add',
  'core-competency', 'mission-critical', 'value-proposition', 'net-net',
  'learnings', 'takeaways', 'swim-lane', 'boil-the-ocean'
];

// Regex for common abbreviation patterns (2-5 uppercase letters)
const ABBREVIATION_REGEX = /\b[A-Z]{2,5}\b/g;

// Common acceptable abbreviations that shouldn't be penalized
const ACCEPTABLE_ABBREVIATIONS = [
  'UK', 'US', 'USA', 'EU', 'UN', 'CEO', 'CTO', 'CFO', 'COO', 'HR', 'IT',
  'PM', 'AM', 'ID', 'OK', 'PDF', 'API', 'URL', 'SQL', 'CSS', 'HTML', 'JSON',
  'MB', 'GB', 'TB', 'KB', 'USD', 'GBP', 'EUR', 'Q1', 'Q2', 'Q3', 'Q4',
  'FY', 'YTD', 'MTD', 'RAG', 'KPI', 'ROI', 'P&L', 'BAU', 'UAT', 'SLA'
];

/**
 * Strip HTML tags from text
 */
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

/**
 * Count sentences in text
 */
const countSentences = (text) => {
  if (!text) return 0;
  // Split on sentence-ending punctuation
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
};

/**
 * Get average words per sentence
 */
const getAvgWordsPerSentence = (text) => {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce((sum, sentence) => {
    return sum + sentence.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, 0);

  return totalWords / sentences.length;
};

/**
 * Count jargon words in text
 */
const countJargon = (text) => {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  return JARGON_WORDS.filter(word =>
    lowerText.includes(word.toLowerCase())
  ).length;
};

/**
 * Find abbreviations that have been defined in the text
 * Patterns detected:
 * - "Full Name (ABBR)" - e.g., "Project Management Office (PMO)"
 * - "ABBR (Full Name)" - e.g., "PMO (Project Management Office)"
 * - "ABBR - Full Name" - e.g., "PMO - Project Management Office"
 */
const findDefinedAbbreviations = (text) => {
  if (!text) return [];

  const defined = [];

  // Pattern 1: "Some Words (ABBR)" - abbreviation in parentheses after words
  const pattern1 = /[A-Za-z\s]+\(([A-Z]{2,5})\)/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    defined.push(match[1]);
  }

  // Pattern 2: "ABBR (Some Words)" - abbreviation before parentheses with definition
  const pattern2 = /\b([A-Z]{2,5})\s*\([A-Za-z\s]+\)/g;
  while ((match = pattern2.exec(text)) !== null) {
    defined.push(match[1]);
  }

  // Pattern 3: "ABBR - Some Words" or "ABBR: Some Words"
  const pattern3 = /\b([A-Z]{2,5})\s*[-:]\s*[A-Za-z]/g;
  while ((match = pattern3.exec(text)) !== null) {
    defined.push(match[1]);
  }

  return [...new Set(defined)]; // Remove duplicates
};

/**
 * Count problematic abbreviations (uppercase letter sequences not in acceptable list
 * and not defined in the text)
 */
const countProblematicAbbreviations = (text) => {
  if (!text) return 0;

  const matches = text.match(ABBREVIATION_REGEX) || [];
  const definedInText = findDefinedAbbreviations(text);

  // Filter out acceptable and defined abbreviations
  const problematic = matches.filter(abbr =>
    !ACCEPTABLE_ABBREVIATIONS.includes(abbr) && !definedInText.includes(abbr)
  );

  // Count unique problematic abbreviations (not total occurrences)
  const uniqueProblematic = [...new Set(problematic)];
  return uniqueProblematic.length;
};

/**
 * Calculate clarity score from 1-5
 * @param {string} text - The text to analyze (can be HTML)
 * @param {string} contentType - 'description' (stricter) or 'comment' (default, more lenient)
 * @returns {object} - { score: 1-5, details: {...} }
 */
export const calculateClarityScore = (text, contentType = 'comment') => {
  const isDescription = contentType === 'description';
  const cleanText = stripHtml(text);

  // Empty text
  if (!cleanText) {
    return {
      score: 1,
      details: {
        length: 0,
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        jargonCount: 0,
        abbreviationCount: 0,
        issues: ['No content']
      }
    };
  }

  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  // Very short text gets low score - encourage substance
  if (cleanText.length < 10) {
    return {
      score: 1,
      details: {
        length: cleanText.length,
        wordCount,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        jargonCount: 0,
        abbreviationCount: 0,
        issues: ['Too short - add more detail']
      }
    };
  }

  const sentenceCount = countSentences(cleanText);
  const avgWordsPerSentence = getAvgWordsPerSentence(cleanText);
  const jargonCount = countJargon(cleanText);
  const abbreviationCount = countProblematicAbbreviations(cleanText);

  // Start at 1 - reward for good writing
  let score = 1;
  const issues = [];

  // 1. Word count - reward for substance (descriptions need more content)
  if (isDescription) {
    // Stricter thresholds for descriptions
    if (wordCount >= 30 && wordCount <= 150) {
      score += 1.5; // Ideal detailed length
    } else if (wordCount >= 20 && wordCount < 30) {
      score += 1; // Good but could be more detailed
    } else if (wordCount >= 12 && wordCount < 20) {
      score += 0.5; // Brief
      issues.push('Brief - consider adding more detail');
    } else if (wordCount > 150 && wordCount <= 250) {
      score += 1; // Acceptable length
    } else if (wordCount > 250) {
      score += 0.5; // Too long
      issues.push('Long - consider summarizing');
    } else {
      // Under 12 words is too brief for descriptions
      issues.push('Very brief - descriptions need more detail');
    }
  } else {
    // More lenient thresholds for comments
    if (wordCount >= 15 && wordCount <= 150) {
      score += 1.5; // Ideal length
    } else if (wordCount >= 8 && wordCount < 15) {
      score += 1; // Brief but acceptable
    } else if (wordCount >= 4 && wordCount < 8) {
      score += 0.5; // Very brief
      issues.push('Brief - consider adding more detail');
    } else if (wordCount > 150 && wordCount <= 250) {
      score += 1; // Acceptable length
    } else if (wordCount > 250) {
      score += 0.5; // Too long
      issues.push('Long - consider summarizing');
    } else {
      // Under 4 words is too brief for comments
      issues.push('Very brief - add more detail');
    }
  }

  // 2. Sentence structure - reward reasonable sentence length
  if (sentenceCount > 0 && wordCount >= 5) {
    if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 20) {
      score += 1.5; // Good sentence length (8-20 words)
    } else if (avgWordsPerSentence >= 5 && avgWordsPerSentence < 8) {
      score += 1; // Acceptable sentence length
    } else if (avgWordsPerSentence > 20 && avgWordsPerSentence <= 25) {
      score += 0.75; // Slightly long but ok
      issues.push('Slightly long sentences');
    } else if (avgWordsPerSentence > 25) {
      issues.push('Long sentences (>25 words avg)');
    } else if (avgWordsPerSentence < 5) {
      score += 0.5; // Very short sentences
    }
  }

  // 3. Plain language - reward no jargon (only if sufficient content)
  const minWordsForBonuses = isDescription ? 10 : 5;
  if (wordCount >= minWordsForBonuses) {
    if (jargonCount === 0) {
      score += 1; // No jargon
    } else if (jargonCount === 1) {
      score += 0.5;
      issues.push('Jargon detected');
    } else {
      issues.push(`Jargon detected (${jargonCount} terms)`);
    }
  }

  // 4. Clear abbreviations - reward no unexplained abbreviations (only if sufficient content)
  if (wordCount >= minWordsForBonuses) {
    if (abbreviationCount === 0) {
      score += 1; // No unexplained abbreviations
    } else if (abbreviationCount === 1) {
      score += 0.5;
      issues.push('Unexplained abbreviation');
    } else {
      issues.push(`Unexplained abbreviations (${abbreviationCount})`);
    }
  }

  // Clamp score to 1-5 range
  score = Math.max(1, Math.min(5, Math.round(score)));

  return {
    score,
    details: {
      length: cleanText.length,
      wordCount,
      sentenceCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      jargonCount,
      abbreviationCount,
      issues
    }
  };
};

/**
 * Get a description of what the clarity score means
 */
export const getClarityDescription = (score) => {
  switch (score) {
    case 5:
      return 'Excellent - Clear, concise, and well-structured';
    case 4:
      return 'Good - Mostly clear with minor improvements possible';
    case 3:
      return 'Average - Could benefit from simplification';
    case 2:
      return 'Below average - Consider shortening and simplifying';
    case 1:
      return 'Poor - Needs significant revision for clarity';
    default:
      return 'Not rated';
  }
};

/**
 * Get the methodology explanation for tooltip
 */
export const getClarityMethodology = () => {
  return `Clarity Score (1-5)

Starts at 1, rewards good writing:

• Good length (20-150 words): +1.5
• Good sentences (8-20 words avg): +1.5
• No jargon: +1
• No unexplained abbreviations: +1

Define abbreviations like: "PMO (Project Management Office)"`;
};

export default calculateClarityScore;
