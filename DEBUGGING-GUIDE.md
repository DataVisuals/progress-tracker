# Debugging Guide

## Comprehensive Error Logging Added

We've added extensive error logging to help diagnose issues, especially white page/blank screen problems.

## What Was Added

### 1. Error Boundary Component (`src/ErrorBoundary.jsx`)

Catches React errors and displays them with a user-friendly error page:
- Shows error message and stack trace
- Logs errors to browser console
- Sends errors to backend for server-side logging
- Provides reload button for recovery

### 2. Global Error Handlers (`src/main.jsx`)

Added handlers for:
- **Uncaught JavaScript errors**: `window.addEventListener('error')`
- **Unhandled promise rejections**: `window.addEventListener('unhandledrejection')`
- **Fatal render errors**: Try-catch around ReactDOM.createRoot()

Console output includes:
- `=== Progress Tracker Starting ===`
- Environment and API URL
- `✅ React app rendered successfully` (if successful)
- Detailed error information (if failed)

### 3. Component-Level Logging

**App.jsx**:
- Logs `=== App Component Rendering ===` on each render

**HomePage.jsx**:
- Logs `=== HomePage Rendering ===`
- Logs counts of projects, projectsData, spaces, portfolios
- Shows selectedSpace value

### 4. Backend Error Logging

**New endpoint**: `POST /api/log-frontend-error`
- Accepts error, stack, componentStack, timestamp
- Logs frontend errors to backend console
- No authentication required (for error reporting)
- Includes User-Agent and IP for debugging

### 5. Defensive Props

**HomePage.jsx** now has default values for props:
```javascript
selectedSpace = 'all',
spaces = [],
portfolios = []
```

This prevents crashes when these props are undefined.

## How to Use When Debugging

### White Page / Blank Screen

1. **Open Browser Console** (F12 or Cmd+Option+I)

2. **Look for these messages**:
   ```
   === Progress Tracker Starting ===
   Environment: development
   API Base URL: default
   === App Component Rendering ===
   === HomePage Rendering ===
   Projects: 50
   ProjectsData keys: 50
   SelectedSpace: all
   Spaces: 5
   Portfolios: 10
   ✅ React app rendered successfully
   ```

3. **If you see errors**:
   - `=== GLOBAL ERROR ===` - JavaScript error during execution
   - `=== UNHANDLED PROMISE REJECTION ===` - Async operation failed
   - `=== FATAL ERROR DURING RENDER ===` - App failed to start
   - `=== ERROR BOUNDARY CAUGHT ERROR ===` - React component error

4. **Check backend logs** for:
   ```
   === FRONTEND ERROR LOGGED ===
   ```

### Common Issues and Their Logs

#### Missing Props
```
=== HomePage Rendering ===
Projects: 0
Spaces: undefined
Portfolios: undefined
```
**Fix**: Check that App.jsx passes all required props

#### API Call Failures
```
=== UNHANDLED PROMISE REJECTION ===
Reason: Failed to fetch
```
**Fix**: Check backend is running, check CORS, check network

#### Component Crash
```
=== ERROR BOUNDARY CAUGHT ERROR ===
Error: Cannot read properties of undefined (reading 'length')
```
**Fix**: Add null checks or default values

### Viewing Error Details

If the app crashes, you'll see:
1. **In Browser**: Error boundary page with error message and stack trace
2. **In Browser Console**: Detailed error logs with component stack
3. **In Backend Console**: Copy of error with timestamp and user info

## Testing the Error Logging

### Test Error Boundary

Add this to any component temporarily:
```javascript
throw new Error('Test error boundary');
```

### Test Promise Rejection

Add this anywhere:
```javascript
Promise.reject('Test promise rejection');
```

### Test Global Error

Add this to a component:
```javascript
setTimeout(() => {
  throw new Error('Test global error');
}, 1000);
```

## Production Deployment

All logging is safe for production:
- Console logs help diagnose user-reported issues
- Error boundary provides better UX than white screen
- Backend logging helps track issues across users
- No sensitive data is logged

### Disable Verbose Logging (Optional)

If you want to reduce console noise in production:

1. Wrap console.log statements:
   ```javascript
   if (import.meta.env.DEV) {
     console.log('Debug info');
   }
   ```

2. Or use a logging library that supports log levels

## Files Modified

- ✅ `src/ErrorBoundary.jsx` - New error boundary component
- ✅ `src/main.jsx` - Global error handlers
- ✅ `src/App.jsx` - Component render logging
- ✅ `src/components/HomePage.jsx` - Defensive props, render logging
- ✅ `backend/src/server.js` - Error logging endpoint

## Summary

**Before**: White page with no information
**After**: Detailed error messages in console, error boundary UI, backend logs

This makes debugging deployment issues much easier!
