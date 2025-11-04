.PHONY: help build run stop restart logs clean test backup restore

# Default target
help:
	@echo "Progress Tracker - Docker Commands"
	@echo "==================================="
	@echo "make build          - Build Docker image"
	@echo "make run            - Run containers with docker-compose"
	@echo "make stop           - Stop containers"
	@echo "make restart        - Restart containers"
	@echo "make logs           - View logs (follow mode)"
	@echo "make clean          - Remove containers and images"
	@echo "make test           - Run tests"
	@echo "make backup         - Backup database"
	@echo "make restore        - Restore database from backup"
	@echo "make shell          - Open shell in running container"
	@echo "make health         - Check container health"
	@echo "make production     - Run with production profile (nginx)"

# Build the Docker image
build:
	docker compose build

# Build without cache
build-no-cache:
	docker compose build --no-cache

# Run the application
run:
	docker compose up -d
	@echo "Application started!"
	@echo "Backend API: http://localhost:3001"
	@echo "Frontend: http://localhost:5173"

# Run with production profile (includes nginx)
production:
	docker compose --profile production up -d
	@echo "Application started in production mode!"
	@echo "Access at: http://localhost"

# Stop the application
stop:
	docker compose down

# Restart the application
restart:
	docker compose restart

# View logs
logs:
	docker compose logs -f

# Clean up containers, images, and volumes
clean:
	docker compose down -v
	docker rmi progress-tracker 2>/dev/null || true
	@echo "Cleanup complete"

# Clean everything including database
clean-all: clean
	rm -rf backend/data/*.db
	@echo "Database removed"

# Open shell in running container
shell:
	docker compose exec progress-tracker sh

# Check health
health:
	@docker inspect --format='{{.State.Health.Status}}' progress-tracker 2>/dev/null || echo "Container not running"

# Run tests
test:
	cd backend && npm test

# Backup database
backup:
	@mkdir -p backups
	docker exec progress-tracker sqlite3 /app/backend/data/progress-tracker.db ".backup '/app/backend/data/backup-$(shell date +%Y%m%d-%H%M%S).db'"
	docker cp progress-tracker:/app/backend/data/backup-$(shell date +%Y%m%d-%H%M%S).db ./backups/
	@echo "Backup created in ./backups/"

# Restore database from most recent backup
restore:
	@LATEST=$$(ls -t backups/*.db | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "No backup found"; \
		exit 1; \
	fi; \
	echo "Restoring from: $$LATEST"; \
	docker cp "$$LATEST" progress-tracker:/app/backend/data/restore.db; \
	docker exec progress-tracker sqlite3 /app/backend/data/progress-tracker.db ".restore '/app/backend/data/restore.db'"; \
	echo "Database restored"

# View container stats
stats:
	docker stats progress-tracker

# View container processes
ps:
	docker compose ps
