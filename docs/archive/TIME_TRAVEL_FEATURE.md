# Time Travel Feature Documentation

## Overview

The Time Travel feature allows you to view historical states of your progress charts based on the audit log. Using a slider interface, you can scrub through time to see how your data evolved.

## Implementation Summary

### 1. Backend (Server-side)

**Endpoint**: `GET /api/projects/:projectId/data/time-travel?timestamp=<ISO_DATE>`

**Location**: `backend/src/server.js:1058-1201`

**How it works**:
- Accepts a timestamp parameter
- Retrieves all audit log entries for `metric_periods` up to that timestamp
- Replays the audit log chronologically to reconstruct historical state
- Handles CREATE, UPDATE, and DELETE operations
- Returns data in the same format as the current project data endpoint

**Example**:
```bash
GET /api/projects/1/data/time-travel?timestamp=2025-10-15T14:30:00.000Z
```

### 2. Frontend Components

#### TimeTravel Component (`src/components/TimeTravel.jsx`)

**Features**:
- Fetches all audit log timestamps for the current project
- Displays a horizontal slider representing the timeline
- Shows current timestamp being viewed
- Visual indicator when viewing historical data (amber/yellow theme)
- Automatically hides if no historical data exists

**UI Elements**:
- **Slider**: Drag to move through time (Past → Present)
- **Timestamp Display**: Shows the current date/time being viewed
- **"Viewing History" Badge**: Appears when not at present
- **Snapshot Counter**: Shows total number of historical snapshots available

#### Styling (`src/components/TimeTravel.css`)

**Design**:
- Clean, modern slider interface
- Gradient backgrounds for visual appeal
- Blue gradient slider track (gray → blue, representing past → present)
- Circular thumb with hover effects
- Active state: Amber/yellow theme when viewing history
- Inactive state: Gray/blue theme when at present

### 3. App Integration (`src/App.jsx`)

**Changes**:
- Added `timeTravelTimestamp` state
- Modified `loadProjectData()` to accept optional timestamp parameter
- Created `handleTimeTravelChange()` to switch between present and historical views
- TimeTravel component placed above MetricChart
- Chart editing disabled when viewing historical data

### 4. API Client (`src/api/client.js`)

**New Method**:
```javascript
getProjectDataTimeTravel(projectId, timestamp)
```

### 5. Historical Data Simulation

**Script**: `backend/src/simulate-historical-edits.js`

**Purpose**: Generate realistic historical audit data for testing

**What it does**:
- Creates 50 audit log entries over 30 days
- Simulates progressive updates to metric periods
- Adds timestamped edits at various intervals
- Useful for demonstrating the time travel feature

**Run it**:
```bash
node backend/src/simulate-historical-edits.js
```

## How to Use

1. **Start the application**:
   ```bash
   # Terminal 1: Backend
   node backend/src/server.js

   # Terminal 2: Frontend
   npm run dev
   ```

2. **Login** to the application (use admin@example.com / admin123)

3. **Select a project** that has historical data

4. **Use the Time Travel slider**:
   - The slider appears below the project title, above the chart
   - Drag the slider left to go back in time
   - Drag it right to move forward
   - All the way right = Present (current data)
   - Timestamps update in real-time as you drag

5. **View historical states**:
   - Chart updates to show data as it existed at that moment
   - "Viewing History" badge appears when not at present
   - Editing is disabled when viewing historical data

## Key Features

✅ **Slider-based interface**: Intuitive scrubbing through timeline
✅ **Real-time updates**: Chart updates as you drag the slider
✅ **Visual feedback**: Color changes and badges indicate time travel mode
✅ **Automatic detection**: Only shows when historical data exists
✅ **Read-only mode**: Prevents accidental edits to historical data
✅ **Timestamp display**: Shows exact date/time being viewed
✅ **Audit-based**: Uses existing audit log infrastructure

## Technical Details

### Time Travel Algorithm

The backend reconstructs historical state by:

1. Getting all current metric_periods for the project
2. Fetching audit log entries up to the target timestamp
3. Starting with empty state
4. Replaying each audit entry in chronological order:
   - **CREATE**: Add period to state
   - **UPDATE**: Modify period values
   - **DELETE**: Mark period as non-existent
5. Return only periods that existed at that point in time

### Performance Considerations

- Audit logs are indexed by `created_at` for fast retrieval
- State reconstruction happens in-memory (fast for reasonable datasets)
- Frontend caches timestamps to avoid repeated API calls
- Slider updates are debounced through React state management

## Future Enhancements

Potential improvements:
- Add keyboard shortcuts (arrow keys to navigate)
- Play/pause animation through time
- Speed controls for time animation
- Export historical snapshots
- Compare two time periods side-by-side
- Show audit log events as markers on the slider

## Testing

To test with real data:

```bash
# 1. Generate historical data
node backend/src/simulate-historical-edits.js

# 2. Start servers
node backend/src/server.js  # Terminal 1
npm run dev                 # Terminal 2

# 3. Open browser to http://localhost:5173
# 4. Login and select a project
# 5. Use the time travel slider!
```

## Files Modified/Created

### Created:
- `src/components/TimeTravel.jsx`
- `src/components/TimeTravel.css`
- `backend/src/simulate-historical-edits.js`
- `TIME_TRAVEL_FEATURE.md` (this file)

### Modified:
- `backend/src/server.js` (added time-travel endpoint)
- `src/api/client.js` (added API method)
- `src/App.jsx` (integrated TimeTravel component)

## Example Use Cases

1. **Debugging**: "What did the chart look like when we saw that spike?"
2. **Reporting**: "Show me our progress as of the end of Q3"
3. **Analysis**: "How has our completion rate changed over time?"
4. **Auditing**: "Were these values correct when we submitted the report?"
5. **Training**: "Let me show you how the project evolved"

---

**Built with**: React, Node.js, SQLite, Recharts
**Feature Status**: ✅ Complete and tested
