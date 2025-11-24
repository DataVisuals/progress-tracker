import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'

console.log('=== Progress Tracker Starting ===');
console.log('Environment:', import.meta.env.MODE);
console.log('API Base URL:', import.meta.env.VITE_API_URL || 'default');

// Global error handler
window.addEventListener('error', (event) => {
  console.error('=== GLOBAL ERROR ===');
  console.error('Message:', event.message);
  console.error('Source:', event.filename);
  console.error('Line:', event.lineno, 'Column:', event.colno);
  console.error('Error object:', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Reason:', event.reason);
  console.error('Promise:', event.promise);
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('=== FATAL ERROR DURING RENDER ===');
  console.error(error);
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: system-ui; max-width: 800px; margin: 0 auto;">
      <h1 style="color: #dc2626;">Fatal Error</h1>
      <p>Failed to start the application. Check the console for details.</p>
      <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin-top: 20px; font-family: monospace; font-size: 14px;">
        <strong>Error:</strong> ${error.toString()}
        ${error.stack ? `
          <details style="margin-top: 10px;">
            <summary style="cursor: pointer; font-weight: bold; margin-bottom: 5px;">Stack Trace</summary>
            <pre style="margin-top: 10px; white-space: pre-wrap; font-size: 12px; overflow: auto;">${error.stack}</pre>
          </details>
        ` : ''}
      </div>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #003c71; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        Reload Page
      </button>
    </div>
  `;
}
