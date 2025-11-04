# Docker Setup for Progress Tracker

This document describes how to build and run the Progress Tracker application using Docker.

## Prerequisites

- Docker (v20.10+)
- Docker Compose (v2.0+)

## Quick Start

### 1. Build and Run with Docker Compose

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

The application will be available at:
- Backend API: http://localhost:3001
- Frontend: http://localhost:5173

### 2. Build Docker Image Only

```bash
# Build the image
docker build -t progress-tracker .

# Run the container
docker run -d \
  --name progress-tracker \
  -p 3001:3001 \
  -v $(pwd)/backend/data:/app/backend/data \
  progress-tracker
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secure-secret-key-here
```

### Database Persistence

The SQLite database is persisted using Docker volumes:

```yaml
volumes:
  - ./backend/data:/app/backend/data
```

This ensures your data is not lost when containers are recreated.

## Production Deployment

### With Nginx Reverse Proxy

For production deployments with Nginx:

```bash
# Start with production profile
docker-compose --profile production up -d
```

This will:
- Serve the frontend via Nginx on port 80
- Proxy API requests to the backend
- Enable gzip compression
- Cache static assets

### Custom Domain Setup

Update `nginx.conf` to use your domain:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    # ... rest of config
}
```

For HTTPS, add SSL certificates:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # ... rest of config
}
```

## Docker Commands Reference

### Build

```bash
# Build the image
docker build -t progress-tracker .

# Build with no cache
docker build --no-cache -t progress-tracker .

# Build for specific platform
docker build --platform linux/amd64 -t progress-tracker .
```

### Run

```bash
# Run in detached mode
docker run -d --name progress-tracker -p 3001:3001 progress-tracker

# Run with environment file
docker run -d --name progress-tracker --env-file backend/.env -p 3001:3001 progress-tracker

# Run with volume mount
docker run -d --name progress-tracker \
  -v $(pwd)/backend/data:/app/backend/data \
  -p 3001:3001 \
  progress-tracker
```

### Manage

```bash
# View logs
docker logs progress-tracker
docker logs -f progress-tracker  # Follow logs

# Stop container
docker stop progress-tracker

# Start container
docker start progress-tracker

# Restart container
docker restart progress-tracker

# Remove container
docker rm progress-tracker

# Remove image
docker rmi progress-tracker
```

### Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Scale services (if applicable)
docker-compose up -d --scale progress-tracker=3

# Execute command in running container
docker-compose exec progress-tracker sh

# View status
docker-compose ps
```

## Health Checks

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' progress-tracker

# View health check logs
docker inspect --format='{{json .State.Health}}' progress-tracker | jq
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs progress-tracker
```

### Database issues

Ensure the data directory has correct permissions:
```bash
chmod -R 755 backend/data
```

### Port already in use

Stop any services using ports 3001 or 5173:
```bash
lsof -ti:3001 | xargs kill
lsof -ti:5173 | xargs kill
```

### Connect to running container

```bash
docker exec -it progress-tracker sh
```

### Reset database

```bash
docker-compose down
rm -rf backend/data/*.db
docker-compose up -d
```

## Multi-Stage Build

The Dockerfile uses a multi-stage build to:
1. **Stage 1**: Build the frontend with Vite
2. **Stage 2**: Install backend dependencies
3. **Stage 3**: Create minimal runtime image

This reduces the final image size significantly.

## Image Size Optimization

The image uses:
- Alpine Linux base (small footprint)
- Multi-stage builds
- Production-only dependencies
- `.dockerignore` to exclude unnecessary files

Expected image size: ~200-300MB

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with secrets
2. **JWT Secret**: Use a strong, random secret in production
3. **Network**: Use Docker networks to isolate containers
4. **Updates**: Regularly update base images
5. **Volumes**: Set appropriate permissions on mounted volumes

## Cloud Deployment

### AWS ECS

```bash
# Build for ARM64 (Graviton)
docker build --platform linux/arm64 -t progress-tracker .

# Tag for ECR
docker tag progress-tracker:latest <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/progress-tracker:latest
```

### Docker Hub

```bash
# Tag for Docker Hub
docker tag progress-tracker <username>/progress-tracker:latest

# Push to Docker Hub
docker login
docker push <username>/progress-tracker:latest
```

### Google Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/<project-id>/progress-tracker

# Deploy to Cloud Run
gcloud run deploy progress-tracker \
  --image gcr.io/<project-id>/progress-tracker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Monitoring

### Container Stats

```bash
# View resource usage
docker stats progress-tracker

# View detailed info
docker inspect progress-tracker
```

### Logs

```bash
# View last 100 lines
docker logs --tail 100 progress-tracker

# View logs since 1 hour ago
docker logs --since 1h progress-tracker

# Export logs to file
docker logs progress-tracker > container.log 2>&1
```

## Backup and Restore

### Backup Database

```bash
# Create backup
docker exec progress-tracker sqlite3 /app/backend/data/progress-tracker.db ".backup '/app/backend/data/backup.db'"

# Copy to host
docker cp progress-tracker:/app/backend/data/backup.db ./backup.db
```

### Restore Database

```bash
# Copy backup to container
docker cp ./backup.db progress-tracker:/app/backend/data/restore.db

# Restore
docker exec progress-tracker sqlite3 /app/backend/data/progress-tracker.db ".restore '/app/backend/data/restore.db'"
```

## Development

For development with hot-reload, use the local setup instead of Docker, or create a `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  progress-tracker-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend/src:/app/backend/src
      - ./src:/app/frontend/src
    ports:
      - "3001:3001"
      - "5173:5173"
    environment:
      - NODE_ENV=development
```

Then run:
```bash
docker-compose -f docker-compose.dev.yml up
```
