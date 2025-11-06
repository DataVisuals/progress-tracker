# Progress Tracker

**Understand where your project stands using numbers, not words.**

A modern web application for tracking project metrics and progress across multiple initiatives. Define how your key metrics should evolve and track their trajectory over time with intelligent automation and role-based access control.

![Progress Tracker Screenshot](screenshot.png)

## 🌐 Live Demo

Visit our [showcase site](https://datavisuals.github.io/progress-tracker/) to explore all features.

## 🚀 Quick Start

### Docker (Recommended) 🐳

```bash
git clone https://github.com/DataVisuals/progress-tracker.git
cd progress-tracker
docker build -t progress-tracker .
docker run -d -p 3001:3001 -v $(pwd)/backend/data:/app/backend/data progress-tracker
# Access at http://localhost:3001
```

### Local Development 💻

```bash
git clone https://github.com/DataVisuals/progress-tracker.git
cd progress-tracker

# Install and start backend
cd backend && npm install && node src/migrate-mock-data.js && node src/server.js &

# Install and start frontend
cd .. && npm install && npm run dev
```

**Default credentials:** admin@example.com / admin123

---

## 📚 Documentation

<details>
<summary><strong>📖 Installation & Setup</strong></summary>

### Prerequisites

**Docker:**
- Docker 20.10+
- Docker Compose 2.0+

**Local Development:**
- Node.js 16+
- Python 3, make, C++ compiler (for better-sqlite3)

### Docker Installation

```bash
# Build
docker build -t progress-tracker .
docker build --no-cache -t progress-tracker .  # Clean build

# Run
docker run -d --name progress-tracker \\
  -p 3001:3001 \\
  -v $(pwd)/backend/data:/app/backend/data \\
  progress-tracker

# Docker Compose
docker-compose up -d                    # Start
docker-compose logs -f                  # Logs
docker-compose down                     # Stop

# Production with Nginx
docker-compose --profile production up -d
```

### Local Installation

```bash
# 1. Clone
git clone https://github.com/DataVisuals/progress-tracker.git
cd progress-tracker

# 2. Install
cd backend && npm install
cd .. && npm install

# 3. Initialize database
cd backend && node src/migrate-mock-data.js

# 4. Start services
cd backend && node src/server.js        # Terminal 1
npm run dev                              # Terminal 2 (from root)
```

### Cloud Deployment

**AWS ECS:**
```bash
aws ecr get-login-password --region us-east-1 | \\
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build --platform linux/arm64 -t progress-tracker .
docker tag progress-tracker <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest
```

**Google Cloud Run:**
```bash
gcloud builds submit --tag gcr.io/<project-id>/progress-tracker
gcloud run deploy --image gcr.io/<project-id>/progress-tracker \\
  --platform managed --port 3001 --allow-unauthenticated
```

**Docker Hub:**
```bash
docker tag progress-tracker <username>/progress-tracker:latest
docker login && docker push <username>/progress-tracker:latest
```

### Troubleshooting

**Port in use:**
```bash
lsof -ti:3001 | xargs kill
```

**Build fails:**
Ensure Docker supports multi-stage builds (17.05+). Try: `docker build --no-cache`

**Container logs:**
```bash
docker logs -f progress-tracker
```

</details>

<details>
<summary><strong>✨ Features</strong></summary>

### Latest Features

**⏪ Time Travel Revert** (Admin)
- Restore project data to any historical state
- Full audit trail with change counts
- Reversible operations

**✏️ Enhanced Inline Editing**
- Auto-select first metric
- Copy/paste support
- Future period protection
- Compact modal design

**📥 Excel Import** (Admin/PM)
- Template-based bulk import
- Comprehensive validation
- Smart upsert (no deletions)

**🔍 Data Consistency Reports** (Admin)
- Vacation month detection
- Front/back-loaded growth patterns
- Portfolio filtering

**🔗 Project Links**
- External resource organization
- Custom labels and ordering

**👤 User Profile Management**
- Self-service updates
- Password changes

**📊 Portfolio Management**
- Project grouping
- Color coding
- Dashboard views

### Core Features

**Project Management**
- Multi-project dashboard
- Streamlined setup
- RBAC permissions
- Portfolio organization

**Visual Analytics**
- Interactive progress charts
- Draggable expected line
- Real-time updates
- PDF export

**Progression Curves**
1. **Linear** - Equal progress each period
2. **Exponential** - Slow start, rapid end (back-loaded)
3. **S-Curve** - Slow/fast/slow adoption pattern
4. **Logarithmic** - Fast start, gradual finish (front-loaded)

**Data Management**
- Smart data grid with inline editing
- Target value propagation
- Bulk period creation
- Copy/paste support
- Future period protection

**Commentary System**
- Period-specific notes
- Visual highlighting
- Chronological sorting

**CRAID Management**
- Track Concerns, Risks, Assumptions, Issues, Dependencies
- Priority and status tracking
- Age-based alerts

**Authentication & Security**
- Role-based access (Admin, PM, Viewer)
- JWT authentication
- bcrypt password hashing
- Audit logging

**Audit & Compliance**
- Comprehensive audit log
- Historic edit protection
- Time travel feature
- Filterable history

**Data Export & Import**
- Automated daily Excel exports
- Manual export API
- Bulk import from Excel

</details>

<details>
<summary><strong>🛠 Tech Stack</strong></summary>

### Frontend
- React 18, Vite, Recharts
- Axios, React Icons, React Select

### Backend
- Node.js, Express
- better-sqlite3 (requires native compilation)
- JWT, bcrypt, node-cron, ExcelJS, multer

### Deployment
- Docker with multi-stage builds
- Alpine Linux base (~200-300MB)
- Nginx reverse proxy
- Native module compilation (python3, make, g++)

</details>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
progress-tracker/
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # Container orchestration
├── nginx.conf                  # Production proxy
├── backend/
│   ├── data/                  # SQLite database
│   ├── exports/               # Excel exports
│   └── src/
│       ├── server.js         # Express API
│       ├── db-sqljs.js       # Database utilities
│       ├── permissions.js    # RBAC
│       └── ...
├── src/
│   ├── components/           # React components
│   ├── api/client.js        # HTTP client
│   └── App.jsx              # Main app
├── docs/                     # GitHub Pages
└── README.md                 # This file
```

</details>

<details>
<summary><strong>📊 Database Schema</strong></summary>

### Tables
- **users** - Authentication and roles
- **portfolios** - Project groupings
- **projects** - Project definitions
- **project_permissions** - PM access control
- **project_links** - External links
- **metrics** - Metric definitions with progression curves
- **metric_periods** - Time-series data (expected, target, complete)
- **comments** - Period commentary
- **craids** - Risks, issues, dependencies
- **audit_log** - Change tracking

### Relationships
```
portfolios (1) ──< (N) projects
projects (1) ──< (N) metrics
metrics (1) ──< (N) metric_periods
metric_periods (1) ──< (N) comments
users (N) ><  (N) projects (via project_permissions)
```

</details>

<details>
<summary><strong>🔑 API Endpoints</strong></summary>

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/change-password` - Change password
- `PUT /api/auth/profile` - Update profile

### Portfolios
- `GET /api/portfolios` - List
- `POST /api/portfolios` - Create
- `PUT /api/portfolios/:id` - Update
- `DELETE /api/portfolios/:id` - Delete

### Projects
- `GET /api/projects` - List
- `POST /api/projects` - Create
- `PUT /api/projects/:id` - Update
- `DELETE /api/projects/:id` - Delete

### Data
- `GET /api/projects/:id/data` - Get metrics/periods
- `GET /api/projects/:id/data/time-travel` - Historical state
- `POST /api/projects/:id/data/revert` - Revert (Admin)
- `POST /api/metrics` - Create metric
- `POST /api/metric-periods` - Create period
- `POST /api/metric-periods/bulk` - Bulk create

### Admin
- `GET /api/users` - List users
- `PUT /api/users/:id/role` - Update role
- `GET /api/audit` - Audit log
- `GET /api/admin/consistency-report` - Data quality

### Import/Export
- `GET /api/import/template` - Download template
- `POST /api/import` - Upload file
- `GET /api/export` - Generate export

### Health
- `GET /api/health` - Health check

</details>

<details>
<summary><strong>🎓 Key Concepts</strong></summary>

### Target Propagation
Change any period's target → all subsequent periods update automatically

### Draggable Expected Line
Hover over green dots → drag up/down → release to save

### Historic Edit Protection
Past period completion values locked to admins, audit trail tracks all changes

### Time Travel & Revert
View project at any historical point, admins can revert to previous state

### Progression Curves
- **Linear**: Predictable increments
- **Exponential**: Back-loaded (slow → fast)
- **S-curve**: Adoption curve (slow → fast → slow)
- **Logarithmic**: Front-loaded (fast → slow)

</details>

<details>
<summary><strong>🔒 Security</strong></summary>

### Production Checklist
1. Change default credentials
2. Use strong JWT secret (32+ chars)
3. Enable HTTPS with SSL/TLS
4. Never commit `.env` files
5. Regular security updates
6. Run `docker scan progress-tracker`
7. Set proper volume permissions
8. Implement rate limiting
9. Regular database backups

### SSL/TLS Setup
Update `nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... config
}
```

</details>

<details>
<summary><strong>🧪 Testing & Development</strong></summary>

### Testing
```bash
cd backend
npm test                # Run tests
npm run test:watch      # Watch mode
```

### Generate Test Data
```bash
cd backend
node src/seed-diverse-data.js
```

Creates 7 projects across 5 portfolios with realistic data.

### Development Mode
```bash
cd backend && npm run dev    # Backend with auto-reload
npm run dev                   # Frontend with HMR
```

### Build
```bash
npm run build               # Frontend
docker build -t progress-tracker .  # Docker
```

</details>

<details>
<summary><strong>🤝 Contributing</strong></summary>

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes
4. Commit (`git commit -m 'Add amazing feature'`)
5. Push (`git push origin feature/amazing-feature`)
6. Open Pull Request

Follow existing code style, add tests, update docs.

</details>

<details>
<summary><strong>📄 License & Support</strong></summary>

### License
MIT License - free for personal and commercial use

### Support
- **Issues**: [GitHub Issues](https://github.com/DataVisuals/progress-tracker/issues)
- **Documentation**: This README
- **Live Demo**: https://datavisuals.github.io/progress-tracker/

### Roadmap
- Multi-language support
- Advanced analytics/forecasting
- Mobile app
- JIRA/Azure DevOps integrations
- Real-time collaboration

</details>

---


---

## 📖 Additional Documentation

- [README-DOCKER.md](./README-DOCKER.md) - Docker quick reference
- [DOCKER.md](./DOCKER.md) - Detailed Docker guide
- [SCRIPTS.md](./SCRIPTS.md) - Utility scripts

**Archived Documentation** (in `docs/archive/`):
- TIME_TRAVEL_FEATURE.md - Time travel implementation details
- PROJECT_DESCRIPTION_FEATURE.md - Project description feature docs  
- TEST_REPORT.md - Testing documentation

---

**Made with ❤️ for project managers who need clarity and control**
