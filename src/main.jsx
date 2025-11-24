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
    <div style="padding: 40px; font-family: system-ui;">
      <h1 style="color: #dc2626;">Fatal Error</h1>
      <p>Failed to start the application. Check the console for details.</p>
      <pre style="background: #fee2e2; padding: 20px; border-radius: 8px;">${error.toString()}</pre>
    </div>
  `;
}
