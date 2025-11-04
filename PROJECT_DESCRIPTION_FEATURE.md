# Project Description Feature

## Overview
The project description feature allows users to add, view, and edit descriptions for their projects. This feature is fully integrated into the project creation flow, import template, and project viewing/editing interface.

## Implementation Summary

### 1. Frontend (React)

#### Added to App.jsx
- **State Management**: Added `editingProjectDesc` and `editProjectDescValue` states to manage description editing
- **Event Handlers**:
  - `handleProjectDescClick()`: Enters edit mode when description is clicked
  - `handleProjectDescKeyDown()`: Handles Enter (save) and Escape (cancel) keys
  - `handleSaveProjectDesc()`: Saves description changes via API

#### UI Components
- **Display Mode**: Shows description as clickable text below project name
  - Displays placeholder text "Click to add a description..." when empty (for editors)
  - Uses `whiteSpace: 'pre-wrap'` to preserve multiline formatting

- **Edit Mode**: Textarea input with:
  - Auto-focus on open
  - Enter to save (Shift+Enter for new lines)
  - Escape to cancel
  - Blur to save
  - Blue border styling to indicate edit mode

#### Permissions
- Only users with edit permissions (admin or PM roles) can edit descriptions
- Viewers can see descriptions but cannot edit them

### 2. Backend (Node.js/Express)

#### Existing API Support
The backend already fully supports project descriptions:

**POST /api/projects** - Create project
```json
{
  "name": "Project Name",
  "description": "Optional description",
  "initiative_manager": "Manager Name",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

**PUT /api/projects/:id** - Update project
```json
{
  "name": "Project Name",
  "description": "Updated description",
  "initiative_manager": "Manager Name",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

**GET /api/projects** - Returns all projects including descriptions
**GET /api/projects/:id** - Returns single project including description

#### Audit Logging
- All description changes are logged in the audit_log table
- Old and new values are captured
- User and timestamp information is recorded

### 3. Import Template

The description field is included in the import template:

**Column 2: Description** (TEXT, optional)
- Can be populated in Excel imports
- Empty values are allowed
- Multiline text is supported

See `/Users/andrewspruce/Code/progress-tracker/backend/src/importService.js` lines 12, 62 for implementation details.

### 4. Project Setup

Description field is available during project creation:

**Location**: `src/components/ProjectSetup.jsx` lines 170-179

Features:
- Optional field (not required)
- Textarea with 2 rows default height
- Placeholder text guides users
- Saved with project on creation

## Testing

### Backend Tests

Location: `/Users/andrewspruce/Code/progress-tracker/backend/src/tests/project.test.js`

**Test Coverage**:
1. Create project with description
2. Create project without description (optional field)
3. Retrieve projects with descriptions
4. Update project description
5. Update description to empty string
6. Update description with multiline text
7. Verify unauthorized access is rejected
8. Verify audit log captures description changes
9. Verify import template includes description field

**Running Tests**:
```bash
cd backend
npm test
```

**Test Configuration**:
- Jest is configured in `backend/jest.config.js`
- Tests use supertest for API testing
- Test database is created/destroyed for each test run
- Tests timeout after 10 seconds

### Frontend Tests

**Status**: Frontend testing framework not yet installed

**To Add Frontend Tests**:
1. Install testing dependencies:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
```

2. Create test file: `src/__tests__/ProjectDescription.test.jsx`

3. Test scenarios to cover:
   - Description displays correctly when present
   - Placeholder shows when description is empty (for editors)
   - Click to edit functionality works
   - Save on Enter key
   - Cancel on Escape key
   - Save on blur
   - Permission checks (editor vs viewer)
   - Multiline text handling

## Usage

### For Users

**Viewing Description**:
- Navigate to any project
- Description appears below the project name
- If no description exists, editors see "Click to add a description..."

**Adding/Editing Description**:
1. Click on the description text or placeholder
2. Type or edit the description
3. Press Enter to save (or Shift+Enter for new line)
4. Press Escape to cancel
5. Click outside textarea to save

**Creating Project with Description**:
1. Click "Project" → "New Project"
2. Fill in project name and other required fields
3. Add description in the "Description" textarea
4. Complete project setup

**Importing Projects with Descriptions**:
1. Download the import template
2. Fill in "Description" column (Column B)
3. Upload the file

### For Developers

**API Usage Example**:
```javascript
// Create project with description
await api.createProject({
  name: 'My Project',
  description: 'This is a detailed project description\nWith multiple lines',
  initiative_manager: 'John Doe',
  start_date: '2024-01-01',
  end_date: '2024-12-31'
});

// Update only description
await api.updateProject(projectId, {
  name: project.name,
  description: 'Updated description',
  initiative_manager: project.initiative_manager,
  start_date: project.start_date,
  end_date: project.end_date
});
```

## Database Schema

The `projects` table includes:
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,  -- Can be NULL or empty string
  initiative_manager TEXT,
  start_date DATE,
  end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Future Enhancements

Potential improvements:
1. Rich text editing (bold, italic, links)
2. Character limit indicator
3. Markdown support
4. Description versioning/history
5. Search by description content
6. Template descriptions for common project types
7. AI-generated description suggestions

## Files Modified

### Frontend
- `/Users/andrewspruce/Code/progress-tracker/src/App.jsx`
  - Added state variables (lines 32-33)
  - Added event handlers (lines 249-281)
  - Added UI components (lines 554-595)

### Backend
- `/Users/andrewspruce/Code/progress-tracker/backend/src/server.js`
  - Added module export for testing (line 2098)
  - Existing PUT endpoint already supports description (lines 256-282)

### Tests
- `/Users/andrewspruce/Code/progress-tracker/backend/src/tests/project.test.js` (new file)
- `/Users/andrewspruce/Code/progress-tracker/backend/jest.config.js` (new file)
- `/Users/andrewspruce/Code/progress-tracker/backend/package.json` (added test scripts)

### Existing Files (No changes needed)
- `/Users/andrewspruce/Code/progress-tracker/src/components/ProjectSetup.jsx` (already has description field)
- `/Users/andrewspruce/Code/progress-tracker/backend/src/importService.js` (already includes description)

## Answer to User Questions

**Q: Is the description also available in the upload template?**

**A: Yes!** The description field is already fully integrated into the import template:
- Column 2 is labeled "Description" (TEXT, optional)
- Defined in `backend/src/importService.js` line 12
- Included in required headers array line 62
- Validated during import
- Can contain multiline text
- Empty values are allowed (optional field)

Users can add descriptions when:
1. Creating projects via UI
2. Importing projects via Excel upload
3. Editing existing projects (click to edit)
4. Using the API directly

All description changes are captured in the audit log for compliance and history tracking.
