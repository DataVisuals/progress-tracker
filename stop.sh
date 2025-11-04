#!/bin/bash

# Progress Tracker - Shutdown Script
# This script stops both the backend and frontend servers gracefully

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Progress Tracker - Shutdown${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to stop a process gracefully
stop_process() {
    local name="$1"
    local pid_file="$2"
    local max_wait=10

    if [ ! -f "$pid_file" ]; then
        echo -e "${YELLOW}⚠️  $name is not running (no PID file)${NC}"
        return 0
    fi

    local pid=$(cat "$pid_file")

    # Check if process is actually running
    if ! ps -p "$pid" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  $name is not running (stale PID: $pid)${NC}"
        rm -f "$pid_file"
        return 0
    fi

    echo -e "${BLUE}🛑 Stopping $name (PID: $pid)...${NC}"

    # Try graceful shutdown first (SIGTERM)
    kill -TERM "$pid" 2>/dev/null || true

    # Wait for process to stop
    local waited=0
    while ps -p "$pid" > /dev/null 2>&1 && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
        echo -ne "${YELLOW}.${NC}"
    done

    # If still running, force kill (SIGKILL)
    if ps -p "$pid" > /dev/null 2>&1; then
        echo -e "\n${YELLOW}⚠️  Process not responding, forcing shutdown...${NC}"
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
    fi

    # Verify it's stopped
    if ps -p "$pid" > /dev/null 2>&1; then
        echo -e "\n${RED}❌ Failed to stop $name${NC}"
        return 1
    else
        echo -e "\n${GREEN}✅ $name stopped successfully${NC}"
        rm -f "$pid_file"
        return 0
    fi
}

# Stop frontend
stop_process "Frontend" "$PID_DIR/frontend.pid"
FRONTEND_EXIT=$?

echo ""

# Stop backend
stop_process "Backend" "$PID_DIR/backend.pid"
BACKEND_EXIT=$?

# Also try to kill any stray processes by port
echo ""
echo -e "${BLUE}🔍 Checking for any remaining processes...${NC}"

# Check for processes on port 5173 (frontend)
FRONTEND_PORT_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PID" ]; then
    echo -e "${YELLOW}⚠️  Found process on port 5173 (PID: $FRONTEND_PORT_PID), stopping...${NC}"
    kill -TERM $FRONTEND_PORT_PID 2>/dev/null || true
    sleep 2
    if ps -p $FRONTEND_PORT_PID > /dev/null 2>&1; then
        kill -KILL $FRONTEND_PORT_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Cleaned up port 5173${NC}"
fi

# Check for processes on port 3001 (backend)
BACKEND_PORT_PID=$(lsof -ti:3001 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PID" ]; then
    echo -e "${YELLOW}⚠️  Found process on port 3001 (PID: $BACKEND_PORT_PID), stopping...${NC}"
    kill -TERM $BACKEND_PORT_PID 2>/dev/null || true
    sleep 2
    if ps -p $BACKEND_PORT_PID > /dev/null 2>&1; then
        kill -KILL $BACKEND_PORT_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Cleaned up port 3001${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FRONTEND_EXIT -eq 0 ] && [ $BACKEND_EXIT -eq 0 ]; then
    echo -e "${GREEN}✨ All services stopped successfully${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some services may not have stopped cleanly${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi
