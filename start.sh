#!/bin/bash

# Progress Tracker - Startup Script
# This script starts both the backend API server and frontend development server

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR"
PID_DIR="$SCRIPT_DIR/.pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create PID directory if it doesn't exist
mkdir -p "$PID_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Progress Tracker - Startup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if a process is running
is_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Running
        else
            rm -f "$pid_file"  # Stale PID file
            return 1  # Not running
        fi
    fi
    return 1  # Not running
}

# Function to wait for service to be ready
wait_for_service() {
    local name="$1"
    local url="$2"
    local max_attempts=30
    local attempt=0

    echo -ne "${YELLOW}⏳ Waiting for $name to be ready"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -ne "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}❌ $name failed to start within ${max_attempts}s${NC}"
    return 1
}

# Check if backend is already running
if is_running "$PID_DIR/backend.pid"; then
    echo -e "${YELLOW}⚠️  Backend is already running (PID: $(cat "$PID_DIR/backend.pid"))${NC}"
else
    echo -e "${BLUE}🚀 Starting backend server...${NC}"

    # Check if node_modules exists in backend
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        cd "$BACKEND_DIR"
        npm install
        cd "$SCRIPT_DIR"
    fi

    # Start backend
    cd "$BACKEND_DIR"
    nohup node src/server.js > "$SCRIPT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$PID_DIR/backend.pid"
    cd "$SCRIPT_DIR"

    # Wait for backend to be ready
    if wait_for_service "Backend" "http://localhost:3001/api/projects"; then
        echo -e "${GREEN}✅ Backend started successfully (PID: $BACKEND_PID)${NC}"
        echo -e "   ${BLUE}API:${NC} http://localhost:3001"
        echo -e "   ${BLUE}Log:${NC} $SCRIPT_DIR/backend.log"
    else
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo -e "${YELLOW}Check logs:${NC} tail -f $SCRIPT_DIR/backend.log"
        exit 1
    fi
fi

echo ""

# Check if frontend is already running
if is_running "$PID_DIR/frontend.pid"; then
    echo -e "${YELLOW}⚠️  Frontend is already running (PID: $(cat "$PID_DIR/frontend.pid"))${NC}"
else
    echo -e "${BLUE}🚀 Starting frontend server...${NC}"

    # Check if node_modules exists in frontend
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
    fi

    # Start frontend
    nohup npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PID_DIR/frontend.pid"

    # Wait for frontend to be ready
    if wait_for_service "Frontend" "http://localhost:5173"; then
        echo -e "${GREEN}✅ Frontend started successfully (PID: $FRONTEND_PID)${NC}"
        echo -e "   ${BLUE}App:${NC} http://localhost:5173"
        echo -e "   ${BLUE}Log:${NC} $SCRIPT_DIR/frontend.log"
    else
        echo -e "${RED}❌ Frontend failed to start${NC}"
        echo -e "${YELLOW}Check logs:${NC} tail -f $SCRIPT_DIR/frontend.log"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Progress Tracker is running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}🌐 Application:${NC} http://localhost:5173"
echo -e "${GREEN}🔧 API Server:${NC}  http://localhost:3001"
echo ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo -e "   ./stop.sh         - Stop all services"
echo -e "   ./restart.sh      - Restart all services"
echo -e "   ./status.sh       - Check service status"
echo -e "   tail -f *.log     - View logs"
echo ""
