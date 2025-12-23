/**
 * User-related utility functions
 */

/**
 * Get user initials from a full name
 * @param {string} name - The user's full name
 * @returns {string} Two-letter initials (uppercase)
 *
 * Examples:
 * - "John Doe" -> "JD"
 * - "Jane" -> "JA"
 * - "" -> "??"
 */
export const getUserInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
