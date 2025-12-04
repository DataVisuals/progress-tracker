/**
 * Token utility functions for handling JWT tokens
 */

/**
 * Decode a JWT token without verification (client-side)
 * @param {string} token - The JWT token
 * @returns {object|null} - Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (err) {
    console.error('Failed to decode token:', err);
    return null;
  }
}

/**
 * Get token expiry time in milliseconds
 * @param {string} token - The JWT token
 * @returns {number|null} - Expiry timestamp in milliseconds or null if invalid
 */
export function getTokenExpiry(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;

  // JWT exp is in seconds, convert to milliseconds
  return decoded.exp * 1000;
}

/**
 * Check if token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} - True if expired, false otherwise
 */
export function isTokenExpired(token) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;

  return Date.now() >= expiry;
}

/**
 * Check if token will expire soon (within threshold)
 * @param {string} token - The JWT token
 * @param {number} thresholdMs - Threshold in milliseconds (default: 1 hour)
 * @returns {boolean} - True if expiring soon, false otherwise
 */
export function isTokenExpiringSoon(token, thresholdMs = 60 * 60 * 1000) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;

  const timeUntilExpiry = expiry - Date.now();
  return timeUntilExpiry <= thresholdMs && timeUntilExpiry > 0;
}

/**
 * Get time until token expires
 * @param {string} token - The JWT token
 * @returns {number|null} - Time until expiry in milliseconds, or null if invalid/expired
 */
export function getTimeUntilExpiry(token) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return null;

  const timeUntil = expiry - Date.now();
  return timeUntil > 0 ? timeUntil : null;
}

/**
 * Store token expiry in localStorage for quick access
 * @param {string} token - The JWT token
 */
export function storeTokenExpiry(token) {
  const expiry = getTokenExpiry(token);
  if (expiry) {
    localStorage.setItem('tokenExpiry', expiry.toString());
  }
}

/**
 * Get stored token expiry from localStorage
 * @returns {number|null} - Expiry timestamp in milliseconds or null
 */
export function getStoredTokenExpiry() {
  const stored = localStorage.getItem('tokenExpiry');
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Clear stored token expiry
 */
export function clearTokenExpiry() {
  localStorage.removeItem('tokenExpiry');
}

/**
 * Format time until expiry as human-readable string
 * @param {number} ms - Milliseconds until expiry
 * @returns {string} - Human-readable time string
 */
export function formatTimeUntilExpiry(ms) {
  if (ms <= 0) return 'Expired';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}
