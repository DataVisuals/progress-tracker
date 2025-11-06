# Progress Tracker - Docker Quick Start

## TL;DR

```bash
# Build and run
make build
make run

# Or using docker compose directly
docker compose up -d

# View logs
make logs

# Stop
make stop
```

## What's Included

- **Multi-stage Docker build** for optimized image size
- **Docker Compose** configuration for easy deployment
- **Nginx reverse proxy** setup for production (optional)
- **Health checks** for monitoring
- **Database persistence** via volumes
- **Makefile** with convenient commands

## Quick Commands

```bash
make help          # Show all available commands
make build         # Build Docker image
make run           # Start application
make stop          # Stop application
make restart       # Restart application
make logs          # View logs (follow mode)
make shell         # Open shell in container
make health        # Check container health
make backup        # Backup database
make restore       # Restore database
make clean         # Remove containers and images
make production    # Run with nginx (production mode)
```

## First Time Setup

1. **Build the image:**
   ```bash
   make build
   ```

2. **Start the application:**
   ```bash
   make run
   ```

3. **Access the application:**
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:5173
   - Health check: http://localhost:3001/api/health

4. **View logs:**
   ```bash
   make logs
   ```

## Production Deployment

For production with Nginx reverse proxy:

```bash
make production
```

This will:
- Build and start the application
- Start Nginx on port 80
- Serve frontend static files
- Proxy API requests to backend
- Enable compression and caching

Access at: http://localhost

## Environment Variables

Create `backend/.env` for custom configuration:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secure-random-secret-here
```

## Database

The SQLite database is persisted in `backend/data/` directory:

```bash
# Backup database
make backup

# Restore from most recent backup
make restore

# View backups
ls -lh backups/
```

## Troubleshooting

**Container won't start:**
```bash
make logs
```

**Port already in use:**
```bash
lsof -ti:3001 | xargs kill
lsof -ti:5173 | xargs kill
```

**Build fails with better-sqlite3 errors:**
The Docker build includes python3, make, and g++ to compile better-sqlite3. If you encounter build errors:
1. Ensure Docker Desktop is running
2. Try rebuilding without cache: `docker build --no-cache -t progress-tracker .`
3. Check that your Docker version supports multi-stage builds (Docker 17.05+)

**Reset everything:**
```bash
make clean-all
make build
make run
```

**Check container health:**
```bash
make health
```

**Access container shell:**
```bash
make shell
```

## Architecture

```
┌─────────────────┐
│     Nginx       │  (Optional - Production)
│   Port 80/443   │
└────────┬────────┘
         │
         ├─────────► Static Files (Frontend)
         │
         └─────────► API Proxy
                    ↓
            ┌───────────────┐
            │   Backend     │
            │   Port 3001   │
            │               │
            │  ┌─────────┐  │
            │  │ SQLite  │  │
            │  │   DB    │  │
            │  └─────────┘  │
            └───────────────┘
```

## File Structure

```
progress-tracker/
├── Dockerfile              # Multi-stage build definition
├── docker-compose.yml      # Docker Compose configuration
├── .dockerignore          # Files to exclude from build
├── nginx.conf             # Nginx configuration (production)
├── Makefile               # Convenient command shortcuts
├── DOCKER.md              # Detailed Docker documentation
└── backend/
    └── data/              # Persistent database directory
        └── progress-tracker.db
```

## Image Details

- **Base:** node:18-alpine
- **Size:** ~200-300MB (optimized with multi-stage build)
- **Stages:**
  1. Frontend build (Vite)
  2. Backend dependencies (with native module compilation)
  3. Runtime image
- **Platform:** linux/amd64, linux/arm64
- **Native Dependencies:** Includes build tools (python3, make, g++) for better-sqlite3 compilation

## Cloud Deployment

### Push to Docker Hub

```bash
docker tag progress-tracker your-username/progress-tracker:latest
docker push your-username/progress-tracker:latest
```

### Deploy to Cloud Provider

**AWS ECS / Fargate:**
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag progress-tracker <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest
```

**Google Cloud Run:**
```bash
gcloud builds submit --tag gcr.io/<project-id>/progress-tracker
gcloud run deploy --image gcr.io/<project-id>/progress-tracker
```

**Azure Container Instances:**
```bash
az acr build --registry <registry-name> --image progress-tracker .
az container create --resource-group <resource-group> --name progress-tracker --image <registry-name>.azurecr.io/progress-tracker:latest
```

## Security Notes

1. Change JWT_SECRET in production
2. Use HTTPS with proper certificates
3. Don't commit .env files
4. Regularly update base images
5. Run security scans on images

## Support

For detailed documentation, see [DOCKER.md](./DOCKER.md)

For general setup, see main [README.md](./README.md)
