const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  enabled: process.env.DETAILED_LOGGING === 'true',
  logLevel: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  logToFile: process.env.LOG_TO_FILE === 'true',
  logDir: process.env.LOG_DIR || path.join(__dirname, 'logs'),
  logFileName: process.env.LOG_FILE_NAME || 'app.log'
};

// Log levels with numeric values for filtering
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Ensure log directory exists if file logging is enabled
if (config.logToFile) {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

/**
 * Format log entry with timestamp and details
 */
function formatLogEntry(level, category, message, details = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level: level.toUpperCase(),
    category,
    message
  };

  if (details) {
    entry.details = details;
  }

  return entry;
}

/**
 * Write log entry to file
 */
function writeToFile(entry) {
  if (!config.logToFile) return;

  try {
    const logPath = path.join(config.logDir, config.logFileName);
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logPath, logLine);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * Core logging function
 */
function log(level, category, message, details = null) {
  // Check if logging is enabled
  if (!config.enabled) return;

  // Check if log level meets threshold
  const currentLevelValue = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;
  const messageLevelValue = LOG_LEVELS[level] || LOG_LEVELS.info;

  if (messageLevelValue < currentLevelValue) return;

  const entry = formatLogEntry(level, category, message, details);

  // Always log to console
  const consoleMethod = level === 'error' ? console.error :
                       level === 'warn' ? console.warn :
                       console.log;

  consoleMethod(`[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`,
                details ? '\n' + JSON.stringify(details, null, 2) : '');

  // Write to file if enabled
  writeToFile(entry);
}

/**
 * Sanitize sensitive data from logging
 */
function sanitize(data) {
  if (!data) return data;

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'password_hash', 'token', 'authorization', 'secret'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

// Convenience methods
const logger = {
  /**
   * Log authentication events
   */
  auth: {
    loginAttempt: (email, ipAddress) => {
      log('info', 'AUTH', `Login attempt for user: ${email}`, { email, ipAddress });
    },

    loginSuccess: (user, ipAddress) => {
      log('info', 'AUTH', `Login successful for user: ${user.email}`, {
        userId: user.id,
        email: user.email,
        role: user.role,
        ipAddress
      });
    },

    loginFailure: (email, reason, ipAddress) => {
      log('warn', 'AUTH', `Login failed for user: ${email} - ${reason}`, {
        email,
        reason,
        ipAddress
      });
    },

    tokenValidation: (success, userId, reason = null) => {
      if (success) {
        log('debug', 'AUTH', `Token validated for user: ${userId}`);
      } else {
        log('warn', 'AUTH', `Token validation failed: ${reason}`, { userId, reason });
      }
    },

    logout: (userId, email) => {
      log('info', 'AUTH', `User logged out: ${email}`, { userId, email });
    }
  },

  /**
   * Log asset creation events (metrics, links, craids, etc.)
   */
  asset: {
    create: (user, assetType, assetData, parentId = null) => {
      log('info', 'ASSET', `${assetType} created by ${user.email}`, {
        userId: user.userId,
        email: user.email,
        assetType,
        assetData: sanitize(assetData),
        parentId
      });
    },

    createFailure: (user, assetType, assetData, error, parentId = null) => {
      log('error', 'ASSET', `${assetType} creation failed for ${user.email}: ${error}`, {
        userId: user.userId,
        email: user.email,
        assetType,
        assetData: sanitize(assetData),
        error: error.toString(),
        parentId
      });
    },

    update: (user, assetType, assetId, oldData, newData) => {
      log('info', 'ASSET', `${assetType} ${assetId} updated by ${user.email}`, {
        userId: user.userId,
        email: user.email,
        assetType,
        assetId,
        changes: {
          old: sanitize(oldData),
          new: sanitize(newData)
        }
      });
    },

    delete: (user, assetType, assetId, assetName = null) => {
      log('warn', 'ASSET', `${assetType} ${assetId} deleted by ${user.email}`, {
        userId: user.userId,
        email: user.email,
        assetType,
        assetId,
        assetName
      });
    }
  },

  /**
   * Log project-related events
   */
  project: {
    createAttempt: (user, projectData) => {
      log('info', 'PROJECT', `Project creation attempt by ${user.email}`, {
        userId: user.userId,
        email: user.email,
        role: user.role,
        projectName: projectData.name,
        projectData: sanitize(projectData)
      });
    },

    createSuccess: (user, projectId, projectData) => {
      log('info', 'PROJECT', `Project created successfully: ${projectData.name}`, {
        projectId,
        userId: user.userId,
        email: user.email,
        projectData: sanitize(projectData)
      });
    },

    createFailure: (user, projectData, error) => {
      log('error', 'PROJECT', `Project creation failed for ${user.email}: ${error}`, {
        userId: user.userId,
        email: user.email,
        projectData: sanitize(projectData),
        error: error.toString()
      });
    },

    permissionCheck: (userId, projectId, action, allowed) => {
      log('debug', 'PROJECT', `Permission check: ${action} on project ${projectId}`, {
        userId,
        projectId,
        action,
        allowed
      });
    },

    update: (user, projectId, oldData, newData) => {
      log('info', 'PROJECT', `Project updated: ${projectId}`, {
        userId: user.userId,
        email: user.email,
        projectId,
        changes: {
          old: sanitize(oldData),
          new: sanitize(newData)
        }
      });
    },

    delete: (user, projectId, projectName) => {
      log('warn', 'PROJECT', `Project deleted: ${projectName}`, {
        userId: user.userId,
        email: user.email,
        projectId,
        projectName
      });
    }
  },

  /**
   * Log exceptions - ALWAYS logs regardless of DETAILED_LOGGING setting
   */
  exception: (category, message, error, details = null) => {
    const entry = formatLogEntry('error', category, message, {
      error: error.message,
      stack: error.stack,
      ...details
    });

    // Always log exceptions to console
    console.error(`[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`,
                  '\n' + JSON.stringify(entry.details, null, 2));

    // Always write exceptions to file if file logging is enabled
    if (config.logToFile) {
      writeToFile(entry);
    }
  },

  /**
   * Generic logging methods
   */
  debug: (category, message, details) => log('debug', category, message, details),
  info: (category, message, details) => log('info', category, message, details),
  warn: (category, message, details) => log('warn', category, message, details),
  error: (category, message, details) => log('error', category, message, details),

  /**
   * Get current configuration
   */
  getConfig: () => ({ ...config }),

  /**
   * Check if logging is enabled
   */
  isEnabled: () => config.enabled
};

module.exports = logger;
