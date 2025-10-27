# Progress Tracker

A modern, comprehensive web application for tracking project metrics, milestones, and progress across multiple initiatives with intelligent automation and role-based access control.

## Demo

![Progress Tracker Demo](demo.gif)

*Interactive dashboard showing real-time progress tracking, draggable expected values, and comprehensive project metrics.*

### Key Capabilities Shown Above:
- 📊 **Visual Progress Charts** - Stacked bars with completed/remaining work
- 📈 **Draggable Expected Line** - Adjust forecasts directly on the chart
- 📅 **Current Period Highlighting** - Clear visual indicator of active timeframe
- 💬 **Inline Commentary** - Add context notes to specific periods
- 🎯 **Scope Tracking** - See target changes over time
- ⚠️ **CRAID Management** - Track risks, issues, and dependencies

## Overview

Progress Tracker provides a powerful yet intuitive platform for project managers and teams to monitor project health, track key metrics, manage risks, and visualize progress over time. Built with modern web technologies, it offers real-time updates, smart progression curves, and comprehensive audit logging.

## Key Features

### 🎯 Project Management
- **Multi-Project Dashboard**: Track unlimited projects with individual metrics and timelines
- **Streamlined Project Setup**: Single-screen project creation capturing all details at once
  - Project metadata (name, manager, description)
  - Reporting schedule (start/end dates, frequency: weekly/monthly/quarterly)
  - Multiple metrics with individual targets
  - Progression curve selection per metric
- **Intelligent Progression Curves**:
  - **Linear**: Equal progress each period
  - **Exponential (S-curve)**: Slow start, rapid middle, slow finish - ideal for adoption/transformation
  - **Logarithmic (Front-loaded)**: Fast initial progress, gradual completion - ideal for research/development
- **Project Permissions**: Granular access control for admins and project managers

### 📊 Visual Analytics
- **Interactive Progress Charts**:
  - Stacked bars showing completed (blue) vs remaining (gray) work
  - Expected progress line (green) with draggable adjustment points
  - Actual progress tracking with variance indicators
  - Current period highlighting with amber background
  - Target line showing scope changes over time
- **Intelligent Date Formatting**: Automatically displays month names for monthly data
- **Scope Change Visualization**: Track and display target adjustments with clear labels
- **Real-time Updates**: Charts refresh dynamically as data changes

### ✏️ Data Management
- **Smart Data Grid**:
  - Inline editing for all metrics
  - Target value propagation - change once, update all subsequent periods automatically
  - Bulk period creation with configurable frequency
  - Add/remove periods on the fly
  - Metric renaming with live updates
- **Flexible Data Entry**: Support for expected values, targets, and completion tracking
- **Draggable Expected Line**: Adjust expected values directly on the chart with visual feedback

### 💬 Commentary System
- **Period-Specific Notes**: Add contextual commentary to any reporting period
- **Visual Highlighting**: Latest comments marked with blue indicators
- **Chronological Sorting**: Most recent updates appear first
- **Inline Editing**: Update commentary directly from the chart view

### ⚠️ CRAID Management
Track project challenges, risks, actions, issues, and dependencies with comprehensive details:
- **Priority Levels**: Critical, High, Medium, Low with color-coded indicators
- **Status Tracking**: Open, In Progress, Closed with visual status badges
- **Age-Based Alerts**: Automatic highlighting of stale items requiring attention
- **Rich Details**: Title, description, owner, due dates, and resolution tracking
- **Organized Views**: Filter and sort by type, priority, or status

### 🔐 Authentication & Security
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full system access, user management, audit log viewing
  - **Project Manager (PM)**: Create projects, manage assigned projects, edit data
  - **Viewer**: Read-only access to all projects
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Session Management**: Automatic token refresh and secure logout
- **Enhanced Login UX**: Clear error feedback with visual animations

### 📋 Audit & Compliance
- **Comprehensive Audit Log**: Track all system changes with:
  - User identification (email and ID)
  - Action type (CREATE, UPDATE, DELETE)
  - Affected table and record ID
  - Old and new values (JSON diff)
  - Descriptive change summaries
  - IP address and timestamp
- **Historic Edit Protection**: Safeguard data integrity with automatic controls:
  - Completion values for past periods (after end date) can only be changed by admins
  - Historic edits are clearly marked with ⚠️ HISTORIC EDIT in the audit log
  - Non-admin users receive clear error messages when attempting historic edits
  - Prevents retroactive manipulation while allowing authorized corrections
- **Time Travel Feature** (Admin/PM only): View historical project state at any point in time
  - Reconstructs complete data state from audit log replay
  - Shows exact completion values, commentary, and variance indicators as they appeared
  - Interactive timeline slider for exploring project history
  - Perfect for retrospectives and historical analysis
- **Filterable History**: Search and filter audit events
- **Admin-Only Access**: Audit log and time travel restricted to authorized users

### 📤 Data Export
- **Automated Excel Exports**: Daily scheduled exports at midnight GMT
- **Manual Export**: On-demand export via API
- **Comprehensive Data**: All projects, metrics, periods, and CRAIDs in structured sheets

### 🎨 User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Modern UI**: Clean, professional interface with intuitive navigation
- **Real-time Feedback**: Instant visual confirmation of all actions
- **Error Handling**: Clear, helpful error messages with suggested fixes
- **Loading States**: Smooth transitions and loading indicators

## Tech Stack

### Frontend
- **React 18**: Modern component-based architecture with hooks
- **Vite**: Lightning-fast build tool and dev server
- **Recharts**: Powerful, composable charting library
- **Axios**: Promise-based HTTP client with interceptors
- **React Icons**: Comprehensive icon library
- **React Select**: Advanced select components with search

### Backend
- **Node.js**: JavaScript runtime for scalable server-side applications
- **Express**: Fast, minimalist web framework
- **SQLite**: Embedded relational database with zero configuration
- **JWT (jsonwebtoken)**: Industry-standard token-based authentication
- **bcrypt**: Secure password hashing with salt rounds
- **node-cron**: Task scheduler for automated exports
- **ExcelJS**: Excel file generation for data exports

### Development Tools
- **ES6+ JavaScript**: Modern syntax with async/await
- **Git**: Version control with comprehensive commit history
- **GitHub**: Code hosting and collaboration

## Getting Started

### Prerequisites
- Node.js 16 or higher
- npm or yarn package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/DataVisuals/progress-tracker.git
cd progress-tracker
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ..
npm install
```

4. **Initialize the database with sample data:**
```bash
cd backend
node src/migrate-mock-data.js
```

This creates:
- Default admin user (admin@example.com / admin123)
- Sample project manager (pm@example.com / pm123)
- Sample viewer (viewer@example.com / viewer123)
- Demo project with multiple metrics

### Running the Application

1. **Start the backend server** (from backend directory):
```bash
node src/server.js
```
- Backend API: http://localhost:3001
- Features automatic database initialization
- Starts daily export scheduler

2. **Start the frontend development server** (from root directory):
```bash
npm run dev
```
- Frontend app: http://localhost:5174
- Hot module replacement enabled
- Automatic browser refresh

3. **Login with default credentials:**

**Admin Access:**
- Email: admin@example.com
- Password: admin123
- Full system access

**Project Manager Access:**
- Email: pm@example.com
- Password: pm123
- Create and manage projects

**Viewer Access:**
- Email: viewer@example.com
- Password: viewer123
- Read-only viewing

## Project Structure

```
progress-tracker/
├── backend/
│   ├── data/                     # SQLite database storage
│   │   └── progress-tracker.db
│   ├── exports/                  # Daily Excel exports
│   ├── src/
│   │   ├── server.js            # Express API server with auth
│   │   ├── db.js                # Database connection & utilities
│   │   ├── permissions.js       # RBAC permission checks
│   │   ├── scheduler.js         # Automated export scheduling
│   │   ├── migrate-mock-data.js # Sample data seeding
│   │   ├── populate-test-data.js # Additional test data
│   │   └── schema-v2.sql        # Normalized database schema
│   └── package.json
├── src/
│   ├── components/
│   │   ├── AuditLog.jsx         # Audit history viewer
│   │   ├── CRAIDs.jsx           # Risk/issue management
│   │   ├── DataGrid.jsx         # Inline data editor
│   │   ├── Login.jsx            # Authentication form
│   │   ├── MetricChart.jsx      # Interactive progress chart
│   │   ├── MetricTabs.jsx       # Metric navigation
│   │   ├── ProjectSelector.jsx  # Project dropdown
│   │   ├── ProjectSetup.jsx     # Project creation wizard
│   │   ├── UserManagement.jsx   # User admin interface
│   │   └── SelectStyles.js      # Consistent select styling
│   ├── api/
│   │   └── client.js            # Axios HTTP client with auth
│   ├── App.jsx                  # Main application component
│   ├── App.css                  # Global styles
│   └── main.jsx                 # Application entry point
├── index.html                    # HTML template
├── demo.mov                      # Application demo video
├── screenshot.png                # UI screenshot
├── package.json                  # Frontend dependencies
└── README.md                     # This file
```

## Database Schema

### Core Tables

**users**: User accounts and authentication
- id, email, password_hash, name, role (admin/pm/viewer)

**projects**: Project definitions
- id, name, description, initiative_manager, created_at

**project_permissions**: PM access control
- project_id, user_id (many-to-many relationship)

**metrics**: Metric definitions with schedule
- id, project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target

**metric_periods**: Time-series data points
- id, metric_id, reporting_date, expected, target, complete

**comments**: Period commentary
- id, period_id, user_id, comment, created_at

**craids**: Challenges, risks, actions, issues, dependencies
- id, project_id, type, title, description, priority, status, owner, due_date, age_days, resolution

**audit_log**: System change tracking
- id, user_id, user_email, action, table_name, record_id, old_values, new_values, description, ip_address, created_at

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login with JWT token generation
- `POST /api/auth/logout` - User logout (client-side token removal)

### Projects
- `GET /api/projects` - List all accessible projects
- `POST /api/projects` - Create new project (admin/PM)
- `PUT /api/projects/:id` - Update project details (admin/PM)
- `DELETE /api/projects/:id` - Delete project (admin/PM)

### Metrics
- `GET /api/projects/:projectId/data` - Get all metrics and periods
- `POST /api/projects/:projectId/metrics` - Create metric with auto-generated periods
- `PUT /api/metrics/:id` - Update metric name
- `DELETE /api/metrics/:id` - Delete metric

### Periods
- `POST /api/periods` - Create new period
- `PUT /api/periods/:id` - Update period (expected, target, complete)
- `PATCH /api/periods/:id` - Partial update (commentary)
- `DELETE /api/periods/:id` - Delete period

### CRAIDs
- `GET /api/projects/:projectId/craids` - List project CRAIDs
- `POST /api/projects/:projectId/craids` - Create CRAID
- `PUT /api/craids/:id` - Update CRAID
- `DELETE /api/craids/:id` - Delete CRAID

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Audit (Admin only)
- `GET /api/audit-log` - Fetch audit log with filters

### Export
- `GET /api/export` - Generate Excel export

## Key Features Explained

### Progression Curves

When creating metrics, choose from three progression models:

1. **Linear** - `y = x`
   - Equal increment each period
   - Best for: Steady, predictable work (e.g., manufacturing, routine tasks)
   - Example: Complete 10 units per month for 10 months = 100 units

2. **Exponential (S-Curve)** - `y = 1/(1 + e^(-10(x-0.5)))`
   - Slow ramp-up, rapid growth, gradual plateau
   - Best for: Technology adoption, organizational transformation, learning curves
   - Example: Software rollout - pilot (slow), mass adoption (fast), stabilization (slow)

3. **Logarithmic (Front-loaded)** - `y = √x`
   - Fast initial progress, diminishing returns
   - Best for: Research, initial development, quick wins
   - Example: Bug fixing - many easy bugs fixed early, harder bugs take longer

### Target Propagation

When editing target values in the Data Grid:
1. Change any period's target value
2. All subsequent periods automatically update to match
3. Eliminates tedious copy/paste operations
4. Maintains data consistency across timeline

### Draggable Expected Line

Adjust expected values directly on charts:
1. Hover over green expected line dots
2. Click and drag up/down to adjust value
3. Visual feedback shows new value
4. Release to save changes
5. Chart updates immediately without page reload

### Role-Based Permissions

Access is controlled at multiple levels:

**Admins can:**
- Create/edit/delete any project
- Manage all users
- View complete audit log
- Access time travel feature
- Make historic edits to past period completion values
- Access all system features

**Project Managers can:**
- Create new projects
- Edit projects they own or are assigned to
- View all projects (read-only for unassigned)
- Access time travel feature
- Edit current and future periods (historic edits blocked)
- Cannot manage users or view audit log

**Viewers can:**
- View all projects and metrics
- Cannot create, edit, or delete anything
- Read-only access to CRAIDs and commentary
- No time travel access

## Development

### Adding New Features

1. **Frontend Components**: Add to `src/components/`
2. **API Endpoints**: Add to `backend/src/server.js`
3. **Database Changes**: Update `backend/src/schema-v2.sql`
4. **Permissions**: Update `backend/src/permissions.js`

### Database Migrations

When modifying the schema:
1. Update `schema-v2.sql`
2. Increment version in schema
3. Update migration script if needed
4. Test with fresh database

### Testing

Manual testing checklist:
- [ ] User login/logout
- [ ] Project creation with curves
- [ ] Metric editing and dragging
- [ ] Target propagation
- [ ] CRAID management
- [ ] Export generation
- [ ] Permission boundaries
- [ ] Audit log recording

## Troubleshooting

### Backend won't start
- Check if port 3001 is already in use
- Verify Node.js version (16+)
- Delete `backend/data/progress-tracker.db` and reinitialize

### Frontend won't connect
- Ensure backend is running on port 3001
- Check browser console for CORS errors
- Verify API base URL in `src/api/client.js`

### Login fails
- Check credentials (case-sensitive)
- Verify database has users (run migrate-mock-data.js)
- Check browser console for network errors

### Charts not displaying
- Verify data exists for selected project
- Check browser console for errors
- Ensure metric has periods with data

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review this README for troubleshooting tips

## Acknowledgments

Built with modern web technologies and best practices for project management visibility.

---

**Made with ❤️ for project managers who need clarity and control**
