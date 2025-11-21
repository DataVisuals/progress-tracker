import { useEffect, useRef } from 'react';

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
export const trackPage = (pageName) => {
  const path = pageName || document.title || window.location.pathname;

  try {
    const data = JSON.stringify({
      path: path,
      session_id: getSessionId()
    });

    const apiUrl = 'http://localhost:3001/api/analytics/pageview';

    // Use sendBeacon for non-blocking fire-and-forget
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(apiUrl, blob);
    } else {
      // Fallback to fetch
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
      }).catch(() => {}); // Silently fail
    }
  } catch (err) {
    // Silently fail - never interrupt user experience
    console.debug('Page tracking failed:', err);
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
