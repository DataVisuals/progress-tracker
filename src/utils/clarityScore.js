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
  'FY', 'YTD', 'MTD', 'RAG', 'KPI', 'ROI', 'P&L', 'BAU', 'UAT', 'SLA',
  // Common status color words (not acronyms, but often written uppercase)
  'RED', 'AMBER', 'GREEN'
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
 * Count syllables in a word (approximation)
 * Rules:
 * - Count vowel groups (consecutive vowels = 1 syllable)
 * - Subtract 1 for silent 'e' at end (if word > 2 chars)
 * - Minimum 1 syllable per word
 */
const countSyllables = (word) => {
  if (!word) return 0;
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g) || [];
  let count = vowelGroups.length;

  // Subtract for silent 'e' at end
  if (word.endsWith('e') && count > 1) {
    count--;
  }

  // Handle common suffixes that add syllables
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) {
    count++; // 'ble', 'tle', 'ple' etc.
  }

  return Math.max(1, count);
};

/**
 * Count total syllables in text
 */
const countTotalSyllables = (text) => {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.reduce((sum, word) => sum + countSyllables(word), 0);
};

/**
 * Calculate Flesch-Kincaid Grade Level
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 * Returns US grade level (e.g., 8 = 8th grade reading level)
 * Lower is easier to read. Target: 6-10 for general business writing.
 */
const calculateFleschKincaid = (text, wordCount, sentenceCount) => {
  if (!text || wordCount < 5 || sentenceCount === 0) return null;

  const syllableCount = countTotalSyllables(text);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  return Math.max(0, Math.round(gradeLevel * 10) / 10);
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
  const fleschKincaid = calculateFleschKincaid(cleanText, wordCount, sentenceCount);

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
    // Lenient thresholds for comments - short updates are fine
    if (wordCount >= 5 && wordCount <= 150) {
      score += 1.5; // Good length for a comment
    } else if (wordCount >= 3 && wordCount < 5) {
      score += 1; // Brief but acceptable
    } else if (wordCount > 150 && wordCount <= 250) {
      score += 1; // Acceptable length
    } else if (wordCount > 250) {
      score += 0.5; // Too long
      issues.push('Long - consider summarizing');
    } else {
      // Under 3 words is too brief
      issues.push('Very brief - add more detail');
    }
  }

  // 2. Readability - use Flesch-Kincaid Grade Level
  // Only apply to longer text (FK unreliable for short text)
  // For business writing, only flag truly excessive complexity
  if (fleschKincaid !== null && wordCount >= 15) {
    if (fleschKincaid <= 16) {
      score += 1.5; // Good readability for professional content
    } else if (fleschKincaid > 16 && fleschKincaid <= 18) {
      score += 1; // Academic level but acceptable
    } else if (fleschKincaid > 18 && fleschKincaid <= 20) {
      score += 0.5; // Getting complex
      issues.push('Complex language (grade ' + fleschKincaid + ')');
    } else if (fleschKincaid > 20) {
      issues.push('Very complex language (grade ' + fleschKincaid + ')');
    }
  } else if (wordCount >= 5) {
    // For shorter text, give benefit of the doubt
    score += 1.5;
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

  // 4. Clear abbreviations - always penalize unexplained abbreviations
  if (abbreviationCount === 0) {
    if (wordCount >= minWordsForBonuses) {
      score += 1; // Bonus only for longer text with no abbreviations
    }
  } else if (abbreviationCount === 1) {
    score -= 0.5; // Penalty for unexplained abbreviation
    issues.push('Unexplained abbreviation');
  } else {
    score -= 1; // Larger penalty for multiple
    issues.push(`Unexplained abbreviations (${abbreviationCount})`);
  }

  // Clamp score to 1-5 range
  score = Math.max(1, Math.min(5, Math.round(score)));

  return {
    score,
    details: {
      length: cleanText.length,
      wordCount,
      sentenceCount,
      fleschKincaid,
      jargonCount,
      abbreviationCount,
      issues
    }
  };
};

/**
 * Get a description of what the clarity score means
 * @param {number} score - The clarity score (1-5)
 * @param {object} details - The scoring details (optional, for context-aware descriptions)
 */
export const getClarityDescription = (score, details = null) => {
  // If we have details, provide context-aware descriptions
  if (details && details.wordCount < 10) {
    switch (score) {
      case 5:
        return 'Excellent';
      case 4:
        return 'Good';
      case 3:
        return 'Average - Add more detail';
      case 2:
        return 'Below average - Needs more detail';
      case 1:
        return 'Poor - Too brief';
      default:
        return 'Not rated';
    }
  }

  // Standard descriptions for longer text
  switch (score) {
    case 5:
      return 'Excellent - Clear, concise, and well-structured';
    case 4:
      return 'Good - Mostly clear with minor improvements possible';
    case 3:
      return 'Average - Could benefit from simplification';
    case 2:
      return 'Below average - Consider simplifying language';
    case 1:
      return 'Poor - Needs revision for clarity';
    default:
      return 'Not rated';
  }
};

/**
 * Get the methodology explanation for tooltip
 * @param {string} contentType - 'description' or 'comment'
 */
export const getClarityMethodology = (contentType = 'comment') => {
  const isDescription = contentType === 'description';
  const wordTarget = isDescription ? '30-150' : '5-150';
  const minWords = isDescription ? '12' : '3';

  return `Clarity Score (1-5)

Score starts at 1, with points added for:

1. LENGTH (up to +1.5)
   Target: ${wordTarget} words
   Minimum for bonuses: ${minWords} words

2. READABILITY (up to +1.5)
   Uses Flesch-Kincaid Grade Level (15+ words)
   Target: Grade 16 or below
   Short text (<15 words) gets full points

3. PLAIN LANGUAGE (up to +1)
   No business jargon detected

4. CLEAR ABBREVIATIONS (up to +1)
   No undefined abbreviations
   Define like: "PMO (Project Management Office)"

Maximum possible: 5 points`;
};

export default calculateClarityScore;
