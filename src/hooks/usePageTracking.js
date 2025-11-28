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

// Track a page view with a specific path/name
// Returns a Promise that resolves when tracking is complete
export const trackPage = async (pageName) => {
  const path = pageName || document.title || window.location.pathname;

  try {
    // Use the api client which handles CORS and credentials properly
    await api.post('/analytics/pageview', {
      path: path,
      session_id: getSessionId()
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
