# Multi-stage build for Progress Tracker

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY package*.json ./
COPY vite.config.js ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY src ./src
COPY index.html ./
COPY public ./public

# Build frontend
RUN npm run build

# Stage 2: Setup backend
FROM node:18-alpine AS backend-setup

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies (production only)
RUN npm ci --only=production

# Stage 3: Final runtime image
FROM node:18-alpine

WORKDIR /app

# Install sqlite3 (needed for runtime)
RUN apk add --no-cache sqlite

# Copy backend files
COPY --from=backend-setup /app/backend/node_modules ./backend/node_modules
COPY backend/src ./backend/src
COPY backend/package*.json ./backend/

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory for SQLite database
RUN mkdir -p /app/backend/data

# Expose ports
EXPOSE 3001 5173

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the backend server
WORKDIR /app/backend
CMD ["node", "src/server.js"]
