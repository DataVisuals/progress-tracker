# Detailed Logging Configuration

This application includes a configurable detailed logging system that tracks authentication events, project creation, and other critical operations.

## Configuration

Logging is controlled via environment variables:

### Environment Variables

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `DETAILED_LOGGING` | Enable/disable detailed logging | `false` | `true` or `false` |
| `LOG_LEVEL` | Minimum log level to record | `info` | `debug`, `info`, `warn`, `error` |
| `LOG_TO_FILE` | Write logs to file in addition to console | `false` | `true` or `false` |
| `LOG_DIR` | Directory for log files | `backend/src/logs` | Any valid path |
| `LOG_FILE_NAME` | Name of the log file | `app.log` | Any valid filename |
| `MAX_LOG_SIZE_MB` | Maximum log file size before rotation (MB) | `10` | Any number (megabytes) |
| `MAX_LOG_FILES` | Number of rotated log files to keep | `5` | Any number |

### Example Configuration

```bash
# Enable detailed logging with debug level
export DETAILED_LOGGING=true
export LOG_LEVEL=debug

# Enable file logging with rotation
export LOG_TO_FILE=true
export LOG_DIR=/var/log/progress-tracker
export LOG_FILE_NAME=app.log
export MAX_LOG_SIZE_MB=50        # Rotate when file reaches 50MB
export MAX_LOG_FILES=10          # Keep last 10 rotated files

# Start the server
npm start
```

Or in your `.env` file:

```env
DETAILED_LOGGING=true
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=./logs
LOG_FILE_NAME=app.log
MAX_LOG_SIZE_MB=10
MAX_LOG_FILES=5
```

## Log Levels

The system supports four log levels (from most to least verbose):

1. **debug** - Detailed diagnostic information (e.g., token validations, permission checks)
2. **info** - General informational messages (e.g., successful logins, project creations)
3. **warn** - Warning messages (e.g., failed login attempts, permission denials)
4. **error** - Error messages (e.g., exceptions, system errors)

When you set `LOG_LEVEL`, only messages at that level or higher will be logged.

## What Gets Logged

### Authentication Events

- **Login Attempts**: Every login attempt is logged with email and IP address
- **Login Success**: Successful logins include user ID, email, role, and IP address
- **Login Failures**: Failed logins include the reason (user not found vs. invalid password)
- **Logout Events**: User logout events are tracked with user ID and email
- **Token Validation**: Token verification results (debug level only)

Example log entry:
```json
{
  "timestamp": "2025-11-10T15:30:45.123Z",
  "level": "INFO",
  "category": "AUTH",
  "message": "Login successful for user: admin@example.com",
  "details": {
    "userId": 1,
    "email": "admin@example.com",
    "role": "admin",
    "ipAddress": "192.168.1.100"
  }
}
```

Logout example:
```json
{
  "timestamp": "2025-11-10T15:45:12.456Z",
  "level": "INFO",
  "category": "AUTH",
  "message": "User logged out: admin@example.com",
  "details": {
    "userId": 1,
    "email": "admin@example.com"
  }
}
```

### Project Creation Events

- **Creation Attempts**: Logs when a user attempts to create a project
- **Creation Success**: Logs successful project creation with all project data
- **Creation Failures**: Logs failures with error details
- **Permission Grants**: Logs when auto-permissions are granted (debug level)

### Asset Creation Events

All asset types are tracked including:
- **Project Links**: Link additions to projects
- **Metrics**: Metric creation with all configuration data
- **CRAIDs**: Challenges, Risks, Assumptions, Issues, and Dependencies
- **Comments**: Comments added to metric periods
- **Portfolios**: Portfolio creation and management

Each asset creation logs:
- User who created it (email and user ID)
- Asset type (project_link, metric, CRAID_risk, etc.)
- Asset data (sanitized for sensitive fields)
- Parent ID (project or period the asset belongs to)

Example project creation log:
```json
{
  "timestamp": "2025-11-10T15:35:12.456Z",
  "level": "INFO",
  "category": "PROJECT",
  "message": "Project created successfully: New Website Launch",
  "details": {
    "projectId": 42,
    "userId": 1,
    "email": "admin@example.com",
    "projectData": {
      "name": "New Website Launch",
      "description": "Q1 2025 website redesign",
      "initiative_manager": "John Doe",
      "start_date": "2025-01-01",
      "end_date": "2025-03-31"
    }
  }
}
```

Example asset creation log:
```json
{
  "timestamp": "2025-11-10T15:40:22.789Z",
  "level": "INFO",
  "category": "ASSET",
  "message": "project_link created by admin@example.com",
  "details": {
    "userId": 1,
    "email": "admin@example.com",
    "assetType": "project_link",
    "assetData": {
      "label": "Project Documentation",
      "url": "https://docs.example.com",
      "display_order": 0
    },
    "parentId": "42"
  }
}
```

### Exception Logging

**IMPORTANT**: All exceptions are ALWAYS logged, regardless of the `DETAILED_LOGGING` setting. This ensures critical errors are never missed.

Exceptions include:
- Full error message
- Complete stack trace
- Contextual information (user ID, request data, etc.)
- Category of the operation that failed

Example exception log:
```json
{
  "timestamp": "2025-11-10T15:50:30.123Z",
  "level": "ERROR",
  "category": "METRIC",
  "message": "Error creating metric",
  "details": {
    "error": "Invalid date format",
    "stack": "Error: Invalid date format\n    at createMetric (/app/server.js:650:15)\n    ...",
    "projectId": "42",
    "requestBody": {
      "name": "Sales Metric",
      "start_date": "invalid-date"
    }
  }
}
```

### Import/Export Operations

- **Export Success**: Logs successful data exports with filename
- **Import Errors**: Always logged with full exception details
- **Export Errors**: Always logged with full exception details

## Security Features

### Sensitive Data Sanitization

The logging system automatically redacts sensitive information:

- Passwords
- Password hashes
- Tokens
- Authorization headers
- Secrets

Any field with these names will be replaced with `***REDACTED***` in the logs.

## Log Format

### Console Output

Logs are written to console in a human-readable format:

```
[2025-11-10T15:30:45.123Z] [INFO] [AUTH] Login successful for user: admin@example.com
{
  "userId": 1,
  "email": "admin@example.com",
  "role": "admin",
  "ipAddress": "192.168.1.100"
}
```

### File Output

When `LOG_TO_FILE=true`, logs are written as JSON lines (one JSON object per line):

```json
{"timestamp":"2025-11-10T15:30:45.123Z","level":"INFO","category":"AUTH","message":"Login successful for user: admin@example.com","details":{"userId":1,"email":"admin@example.com","role":"admin","ipAddress":"192.168.1.100"}}
```

This format is ideal for log aggregation tools like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- CloudWatch

## Usage in Code

The logger module is available throughout the application:

```javascript
const logger = require('./logger');

// Authentication logging
logger.auth.loginAttempt(email, ipAddress);
logger.auth.loginSuccess(user, ipAddress);
logger.auth.loginFailure(email, reason, ipAddress);
logger.auth.logout(userId, email);

// Project logging
logger.project.createAttempt(user, projectData);
logger.project.createSuccess(user, projectId, projectData);
logger.project.createFailure(user, projectData, error);

// Asset logging
logger.asset.create(user, 'project_link', linkData, projectId);
logger.asset.createFailure(user, 'metric', metricData, error, projectId);
logger.asset.update(user, 'portfolio', portfolioId, oldData, newData);
logger.asset.delete(user, 'comment', commentId, commentText);

// Exception logging (ALWAYS logs regardless of DETAILED_LOGGING)
logger.exception('CATEGORY', 'Error message', errorObject, { contextData });

// Generic logging
logger.debug('CATEGORY', 'Debug message', { details });
logger.info('CATEGORY', 'Info message', { details });
logger.warn('CATEGORY', 'Warning message', { details });
logger.error('CATEGORY', 'Error message', { details });

// Check if logging is enabled
if (logger.isEnabled()) {
  // Do something expensive only if logging is on
}
```

## Performance Considerations

- When `DETAILED_LOGGING=false`, logging operations are no-ops with minimal overhead
- **Exception logging ALWAYS runs** to ensure critical errors are captured
- Debug-level logs are only processed when `LOG_LEVEL=debug`
- File I/O is synchronous but only occurs when logging is enabled
- Sensitive data sanitization only runs on objects that will be logged

## Troubleshooting

### Logs Not Appearing

1. Check that `DETAILED_LOGGING=true`
2. Verify `LOG_LEVEL` is set to an appropriate level
3. Ensure the log directory exists and is writable (if using file logging)

### Too Many Logs

1. Increase `LOG_LEVEL` to `warn` or `error`
2. Disable debug-level logging in production
3. Use log rotation tools for file logs

### File Logging Not Working

1. Check that the log directory exists
2. Verify write permissions on the log directory
3. Check disk space availability

## Best Practices

1. **Development**: Use `LOG_LEVEL=debug` to see all activity
2. **Staging**: Use `LOG_LEVEL=info` with file logging
3. **Production**: Use `LOG_LEVEL=warn` or `info` with file logging and log rotation
4. **Never log sensitive data**: The sanitization helps, but avoid logging sensitive data in the first place
5. **Monitor log file size**: Implement log rotation to prevent disk space issues

## Log Rotation

### Built-in Rotation (Default)

The logger includes **automatic log rotation** to prevent disk space issues:

- **Automatic**: Rotation happens automatically when the log file size exceeds the limit
- **Size-based**: Default 10MB per file (configurable via `MAX_LOG_SIZE_MB`)
- **File retention**: Keeps the last 5 rotated files by default (configurable via `MAX_LOG_FILES`)
- **Naming**: Rotated files are named `app.log.1`, `app.log.2`, etc.

**How it works:**
1. When `app.log` reaches the size limit (e.g., 10MB)
2. Existing backups are renamed: `app.log.4` → `app.log.5`, `app.log.3` → `app.log.4`, etc.
3. Current log is renamed: `app.log` → `app.log.1`
4. A new `app.log` file is created
5. The oldest file (`app.log.5` if `MAX_LOG_FILES=5`) is deleted

**Example with custom rotation:**
```bash
# Larger files, more retention for high-volume production
export MAX_LOG_SIZE_MB=100   # 100MB per file
export MAX_LOG_FILES=20      # Keep 20 files = 2GB total max
```

### External Log Rotation Tools (Optional)

For more advanced rotation strategies, you can also use external tools:

#### Linux (logrotate)

Create `/etc/logrotate.d/progress-tracker`:

```
/var/log/progress-tracker/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 node node
    sharedscripts
}
```

#### PM2

If using PM2, it has built-in log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Docker

Use a log aggregation service or mount the log directory as a volume with external rotation.

**Note:** If using external rotation tools, you may want to disable built-in rotation by setting very high limits:
```bash
export MAX_LOG_SIZE_MB=999999  # Effectively disable built-in rotation
```
