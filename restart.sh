#!/bin/bash

# Progress Tracker - Restart Script
# This script restarts both backend and frontend servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Progress Tracker - Restart${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Stop services
"$SCRIPT_DIR/stop.sh"

# Wait a moment to ensure ports are freed
echo ""
echo -e "${BLUE}⏳ Waiting for ports to be released...${NC}"
sleep 2

# Start services
echo ""
"$SCRIPT_DIR/start.sh"
