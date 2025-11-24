import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo
    });

    // Log to backend if available
    try {
      fetch('/api/log-frontend-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error('Failed to log error to backend:', err));
    } catch (e) {
      console.error('Failed to send error to backend:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#dc2626' }}>Something went wrong</h1>
          <p>The application encountered an error. Please check the console for details.</p>

          {this.state.error && (
            <div style={{
              background: '#fee2e2',
              padding: '20px',
              borderRadius: '8px',
              marginTop: '20px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              <strong>Error:</strong> {this.state.error.toString()}
              {this.state.error.stack && (
                <>
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                      JavaScript Stack Trace
                    </summary>
                    <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '12px', overflow: 'auto' }}>
                      {this.state.error.stack}
                    </pre>
                  </details>
                </>
              )}
              {this.state.errorInfo && this.state.errorInfo.componentStack && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                    React Component Stack
                  </summary>
                  <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '12px', overflow: 'auto' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#003c71',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Page
          </button>

          <div style={{ marginTop: '30px', fontSize: '12px', color: '#6b7280' }}>
            <p>If this problem persists:</p>
            <ul>
              <li>Check the browser console (F12) for detailed error messages</li>
              <li>Try clearing your browser cache and reloading</li>
              <li>Contact your administrator with the error details above</li>
            </ul>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
