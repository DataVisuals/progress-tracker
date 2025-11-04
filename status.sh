#!/bin/bash

# Progress Tracker - Status Script
# This script checks the status of backend and frontend servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Progress Tracker - Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ALL_RUNNING=true

# Function to check service status
check_service() {
    local name="$1"
    local pid_file="$2"
    local url="$3"
    local port="$4"

    echo -e "${BLUE}━━━ $name ━━━${NC}"

    # Check PID file
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Process: Running (PID: $pid)"

            # Get process info
            local cpu_mem=$(ps -p "$pid" -o %cpu,%mem | tail -n 1)
            echo -e "  ${BLUE}ℹ${NC} CPU/Mem: $cpu_mem"

            # Check if responding to HTTP
            if [ -n "$url" ]; then
                if curl -s -f "$url" > /dev/null 2>&1; then
                    echo -e "  ${GREEN}✓${NC} HTTP:    Responding at $url"
                else
                    echo -e "  ${RED}✗${NC} HTTP:    Not responding at $url"
                    ALL_RUNNING=false
                fi
            fi
        else
            echo -e "  ${RED}✗${NC} Process: Not running (stale PID: $pid)"
            ALL_RUNNING=false
        fi
    else
        echo -e "  ${RED}✗${NC} Process: Not running (no PID file)"
        ALL_RUNNING=false
    fi

    # Check port
    if [ -n "$port" ]; then
        local port_pid=$(lsof -ti:"$port" 2>/dev/null || true)
        if [ -n "$port_pid" ]; then
            echo -e "  ${BLUE}ℹ${NC} Port:    $port is in use by PID $port_pid"
        else
            echo -e "  ${YELLOW}⚠${NC} Port:    $port is free"
        fi
    fi

    echo ""
}

# Check backend
check_service "Backend API" "$PID_DIR/backend.pid" "http://localhost:3001/api/projects" "3001"

# Check frontend
check_service "Frontend Dev Server" "$PID_DIR/frontend.pid" "http://localhost:5173" "5173"

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_RUNNING" = true ]; then
    echo -e "${GREEN}✨ All services are running normally${NC}"
    echo ""
    echo -e "${GREEN}🌐 Application:${NC} http://localhost:5173"
    echo -e "${GREEN}🔧 API Server:${NC}  http://localhost:3001"
else
    echo -e "${YELLOW}⚠️  Some services are not running${NC}"
    echo ""
    echo -e "${YELLOW}💡 Try running:${NC} ./start.sh"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show logs info
if [ -f "$SCRIPT_DIR/backend.log" ] || [ -f "$SCRIPT_DIR/frontend.log" ]; then
    echo -e "${BLUE}📋 Logs:${NC}"
    if [ -f "$SCRIPT_DIR/backend.log" ]; then
        echo -e "   Backend:  tail -f $SCRIPT_DIR/backend.log"
    fi
    if [ -f "$SCRIPT_DIR/frontend.log" ]; then
        echo -e "   Frontend: tail -f $SCRIPT_DIR/frontend.log"
    fi
    echo ""
fi
