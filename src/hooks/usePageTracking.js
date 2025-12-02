import { useEffect, useRef } from 'react';
import { api } from '../api/client';

// Generate a session ID that persists for the browser session
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Store page load start time
let pageLoadStartTime = null;

// Call this at the start of page load to begin timing
export const startPageLoadTimer = () => {
  pageLoadStartTime = performance.now();
};

// Get the load time since startPageLoadTimer was called
const getLoadTime = () => {
  if (pageLoadStartTime === null) {
    // Fallback: use navigation timing API if available
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry && navEntry.loadEventEnd > 0) {
      return Math.round(navEntry.loadEventEnd - navEntry.startTime);
    }
    return null;
  }
  const loadTime = Math.round(performance.now() - pageLoadStartTime);
  pageLoadStartTime = null; // Reset for next page
  return loadTime;
};

// Track a page view with a specific path/name
// Returns a Promise that resolves when tracking is complete
export const trackPage = async (pageName, options = {}) => {
  const path = pageName || document.title || window.location.pathname;
  const loadTime = options.loadTime !== undefined ? options.loadTime : getLoadTime();

  try {
    // Use the api client which handles CORS and credentials properly
    await api.post('/analytics/pageview', {
      path: path,
      session_id: getSessionId(),
      load_time_ms: loadTime
    });
  } catch (err) {
    // Silently fail - never interrupt user experience
  }
};

// Hook for automatic tracking (tracks initial page load)
export const usePageTracking = () => {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once on mount
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPage('Dashboard'); // Default page name
    }
  }, []);
};
