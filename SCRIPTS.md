# Progress Tracker - Management Scripts

This directory contains shell scripts to easily manage the Progress Tracker application (backend API and frontend dev server).

## Available Scripts

### 🚀 start.sh
Start both backend and frontend services.

```bash
./start.sh
```

**Features:**
- Checks if services are already running (won't start duplicates)
- Automatically installs dependencies if `node_modules` is missing
- Waits for each service to be ready before continuing
- Shows URLs and log file locations
- Creates PID files in `.pids/` directory for tracking

**Output:**
- Backend API: http://localhost:3001
- Frontend App: http://localhost:5173
- Logs: `backend.log` and `frontend.log`

### 🛑 stop.sh
Stop both backend and frontend services gracefully.

```bash
./stop.sh
```

**Features:**
- Gracefully stops processes (SIGTERM first, then SIGKILL if needed)
- Cleans up stale PID files
- Finds and kills processes bound to ports 3001 and 5173
- Handles cases where processes weren't tracked by PID files

**Safety:**
- 10-second grace period for graceful shutdown
- Automatically force-kills unresponsive processes
- Cleans up ports even if PID tracking failed

### 🔄 restart.sh
Restart both services (stop + start).

```bash
./restart.sh
```

**Features:**
- Calls `stop.sh` to cleanly shutdown
- Waits 2 seconds for ports to be released
- Calls `start.sh` to bring services back up

**Use cases:**
- After code changes in backend
- After configuration changes
- When services become unresponsive
- After pulling new code from git

### 📊 status.sh
Check the status of all services.

```bash
./status.sh
```

**Information shown:**
- ✓/✗ Process running status with PID
- CPU and memory usage
- HTTP health check (can the service respond?)
- Port usage (which PID is using which port)
- Log file locations

**Example output:**
```
━━━ Backend API ━━━
  ✓ Process: Running (PID: 27228)
  ℹ CPU/Mem:   0.0  0.4
  ✓ HTTP:    Responding at http://localhost:3001/api/projects
  ℹ Port:    3001 is in use by PID 27228
```

## Process Tracking

The scripts use PID files stored in `.pids/` to track running processes:
- `.pids/backend.pid` - Backend server process ID
- `.pids/frontend.pid` - Frontend dev server process ID

These files are automatically managed by the scripts.

## Log Files

Each service writes to its own log file in the project root:
- `backend.log` - Backend server output
- `frontend.log` - Frontend dev server output

**View logs in real-time:**
```bash
# Watch backend logs
tail -f backend.log

# Watch frontend logs
tail -f frontend.log

# Watch both
tail -f *.log
```

## Common Scenarios

### Starting fresh
```bash
./start.sh
```

### Checking if everything is running
```bash
./status.sh
```

### Services not responding
```bash
./restart.sh
```

### Stopping for the day
```bash
./stop.sh
```

### Debugging issues
```bash
./status.sh          # Check what's running
tail -f backend.log  # View backend errors
tail -f frontend.log # View frontend errors
```

### Cleaning up stuck processes
```bash
./stop.sh  # Will find and kill processes on ports 3001 and 5173
```

## Troubleshooting

### Backend won't start
1. Check the log: `tail -f backend.log`
2. Verify port 3001 is free: `lsof -ti:3001`
3. Check database file exists: `ls -la backend/data/progress-tracker.db`
4. Try: `./stop.sh && ./start.sh`

### Frontend won't start
1. Check the log: `tail -f frontend.log`
2. Verify port 5173 is free: `lsof -ti:5173`
3. Check node_modules: `ls -la node_modules`
4. Reinstall: `rm -rf node_modules && npm install`

### Port already in use
The `stop.sh` script will automatically find and kill processes using ports 3001 and 5173, even if they weren't started by these scripts.

```bash
./stop.sh  # Cleans up ports automatically
```

### Stale PID files
If a service crashed without cleaning up its PID file:

```bash
./status.sh  # Will show "stale PID" warnings
./stop.sh    # Will clean up stale PID files
./start.sh   # Start fresh
```

### Multiple processes running
```bash
# Find all node processes
ps aux | grep node

# Kill specific process
kill -9 <PID>

# Or let the script handle it
./stop.sh  # Cleans up everything
```

## Script Exit Codes

All scripts return appropriate exit codes:
- `0` - Success
- `1` - Failure (service failed to start/stop)

This allows for automation:
```bash
./start.sh && echo "Services started!" || echo "Failed to start"
```

## Requirements

- Bash shell
- Node.js and npm installed
- `lsof` command (for port checking)
- `curl` command (for health checks)

## File Permissions

Scripts are marked as executable:
```bash
chmod +x start.sh stop.sh restart.sh status.sh
```

If you get permission errors, run the chmod command above.

## Development Workflow

**Typical development session:**
```bash
# Morning - start everything
./start.sh

# Check status occasionally
./status.sh

# After backend code changes
./restart.sh

# End of day
./stop.sh
```

**Git workflow:**
```bash
# Pull latest changes
git pull

# Restart to pick up changes
./restart.sh

# Verify everything works
./status.sh
```

## Advanced Usage

### Custom ports
To change ports, edit:
- Backend: `backend/src/server.js` (PORT variable)
- Frontend: `vite.config.js` (server.port)
- Scripts: Update port numbers in all 4 scripts

### Different environments
Create environment-specific scripts:
```bash
cp start.sh start-prod.sh
# Edit start-prod.sh to use NODE_ENV=production
```

### Running in background
Services already run in background (using `nohup`), so you can close the terminal after starting.

### System service (systemd)
To run as a system service on Linux, create systemd unit files:
```bash
# /etc/systemd/system/progress-tracker.service
[Service]
ExecStart=/path/to/progress-tracker/start.sh
ExecStop=/path/to/progress-tracker/stop.sh
```

## Notes

- Scripts use colors for better readability (may not work in all terminals)
- PID tracking prevents duplicate processes
- Graceful shutdown (SIGTERM) is attempted before force kill (SIGKILL)
- Health checks ensure services are actually responding, not just running
- Port cleanup handles edge cases where PID tracking fails

## Support

If scripts aren't working:
1. Check you're in the project root directory
2. Ensure scripts are executable: `ls -l *.sh`
3. View recent logs: `tail -20 backend.log frontend.log`
4. Check for Node.js errors: `node --version`
5. Manually test: `cd backend && node src/server.js`
