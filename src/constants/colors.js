/**
 * Centralized color constants for the Progress Tracker app
 *
 * RAG (Red-Amber-Green) Status Colors:
 * - Used for metric status indicators
 * - These colors should NOT be used for portfolios to avoid confusion
 *
 * Portfolio Colors:
 * - Used for portfolio grouping/organization
 * - Avoid red, amber, green to prevent confusion with RAG status
 */

export const RAG_COLORS = {
  red: '#dc2626',      // Bright red for behind schedule / critical
  amber: '#d97706',    // Darker amber/orange for at risk / warning (more distinct from red)
  green: '#16a34a',    // Green for on track / good
  grey: '#6b7280'      // Medium grey for no data / unknown
};

export const RAG_COLORS_DARK = {
  red: '#ef4444',      // Lighter red for dark mode
  amber: '#f59e0b',    // Lighter amber for dark mode
  green: '#22c55e',    // Lighter green for dark mode
  grey: '#9ca3af'      // Light grey for dark mode
};

// Portfolio colors - avoiding RAG status colors
export const PORTFOLIO_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#64748b', label: 'Slate' }
];

// Space shapes/icons - used to visually distinguish spaces
export const SPACE_SHAPES = [
  { value: 'circle', label: 'Circle', icon: '○' },
  { value: 'square', label: 'Square', icon: '□' },
  { value: 'triangle', label: 'Triangle', icon: '△' },
  { value: 'diamond', label: 'Diamond', icon: '◇' },
  { value: 'star', label: 'Star', icon: '☆' },
  { value: 'diamond-suit', label: 'Diamond Suit', icon: '♢' },
  { value: 'triangle-down', label: 'Triangle Down', icon: '▽' },
  { value: 'circle-large', label: 'Large Circle', icon: '◯' },
  { value: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { value: 'pentagon', label: 'Pentagon', icon: '⬠' }
];
