/**
 * Date formatting utilities for the Progress Tracker application
 */

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago", "3d ago")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Formatted relative time string
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Format a timestamp for audit log display
 * Shows time if today, otherwise shows date
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Formatted audit timestamp string
 */
export const formatAuditTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffMins < 60) return `${diffMins}m ago`;
  if (isToday) return time;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

/**
 * Format a date string in GB locale format (e.g., "22 Dec 2024")
 * @param {string} dateStr - The date string to format
 * @returns {string} Formatted date string, or empty string if no date provided
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Check if a timestamp is recent (within past 7 days)
 * Used for highlighting recently updated comments, links, etc.
 * @param {string|Date} updatedAt - The timestamp to check
 * @returns {boolean} True if the timestamp is within the past 7 days
 */
export const isRecentlyUpdated = (updatedAt) => {
  if (!updatedAt) return false;
  const now = new Date();
  const updateTime = new Date(updatedAt);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return updateTime >= sevenDaysAgo;
};
