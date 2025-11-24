const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const path = require('path');

// Promisify crypto functions
const scrypt = promisify(crypto.scrypt);

// Helper functions for password hashing
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function comparePassword(password, hash) {
  const [salt, key] = hash.split(':');
  const derivedKey = await scrypt(password, salt, 64);
  return key === derivedKey.toString('hex');
}
const { initializeDatabase, generateMetricPeriods, calculateExpectedValue } = require('./db');
const { startScheduler } = require('./scheduler');
const logger = require('./logger');

// Create app with optional database path
function createApp(dbPath) {
  // Initialize database with provided path
  const { db, dbRun, dbGet, dbAll } = initializeDatabase(dbPath);

  // Define permission functions with access to this database instance
  const ROLES = {
    ADMIN: 'admin',
    PM: 'pm',
    EDITOR: 'editor', // Legacy role - treat as PM
    VIEWER: 'viewer'
  };

  // Check if user can edit a project
  async function canEditProject(userId, projectId) {
    const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);

    // Admins can edit anything
    if (user.role === ROLES.ADMIN) {
      return true;
    }

    // Viewers can't edit anything
    if (user.role === ROLES.VIEWER) {
      return false;
    }

    // PMs and Editors can edit if they have permission
    if (user.role === ROLES.PM || user.role === ROLES.EDITOR) {
      const permission = await dbGet(
        'SELECT id FROM project_permissions WHERE user_id = ? AND project_id = ?',
        [userId, projectId]
      );
      return !!permission;
    }

    return false;
  }

  // Check if user can create projects
  function canCreateProject(user) {
    return user.role === ROLES.ADMIN || user.role === ROLES.PM || user.role === ROLES.EDITOR;
  }

  // Check if user is admin
  function isAdmin(user) {
    return user.role === ROLES.ADMIN;
  }

  // Check if user is PM or above (PM or admin)
  function isPMOrAbove(user) {
    return user.role === ROLES.ADMIN || user.role === ROLES.PM;
  }

  // Check if user can edit historic data (admin or PM/editor)
  function canEditHistoricData(user) {
    return user.role === ROLES.ADMIN || user.role === ROLES.PM || user.role === ROLES.EDITOR;
  }

  const app = express();
  const PORT = 3001;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

  app.use(cors());
  app.use(express.json());

  // ===== SERVE FRONTEND STATIC FILES (for Docker deployment) =====
  // Check if frontend build exists (in Docker container)
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  const fs = require('fs');
  if (fs.existsSync(frontendPath)) {
    console.log('📦 Serving frontend from:', frontendPath);
    app.use(express.static(frontendPath));
  }
  
  // ===== HEALTH CHECK =====
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // ===== AUTH MIDDLEWARE =====
  function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      logger.auth.tokenValidation(false, null, 'No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        logger.auth.tokenValidation(false, null, err.message);
        return res.status(403).json({ error: 'Invalid token' });
      }
      logger.auth.tokenValidation(true, user.userId);
      req.user = user;
      next();
    });
  }

  // Optional authentication - sets req.user if token exists, but continues even without token
  function optionalAuthenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return next(); // No token, continue without user
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user; // Token valid, set user
      }
      next(); // Continue regardless of token validity
    });
  }
  
  // ===== AUDIT LOGGING =====
  async function logAudit(user, action, tableName, recordId, oldValues, newValues, description, ipAddress = null) {
    try {
      await dbRun(
        `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user?.userId || user?.id || null,
          user?.email || null,
          action,
          tableName,
          recordId || null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          description,
          ipAddress
        ]
      );
    } catch (err) {
      console.error('Failed to log audit entry:', err);
    }
  }

  // ===== GRANT PERMISSIONS TO INITIATIVE MANAGERS =====
  async function grantPermissionsToInitiativeManagers(projectId, initiativeManager, secondaryPM) {
    const managers = [initiativeManager, secondaryPM].filter(name => name && name.trim());

    for (const managerName of managers) {
      // Look up user by name
      const user = await dbGet('SELECT id FROM users WHERE name = ?', [managerName.trim()]);

      if (user) {
        // Check if permission already exists
        const existingPermission = await dbGet(
          'SELECT id FROM project_permissions WHERE project_id = ? AND user_id = ?',
          [projectId, user.id]
        );

        if (!existingPermission) {
          await dbRun(
            'INSERT INTO project_permissions (project_id, user_id) VALUES (?, ?)',
            [projectId, user.id]
          );
          console.log(`Granted permission to initiative manager "${managerName}" (user ${user.id}) for project ${projectId}`);
        }
      } else {
        console.log(`Initiative manager "${managerName}" not found in users table - no permission granted`);
      }
    }
  }

  // ===== AUTH ROUTES =====
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Log login attempt
      logger.auth.loginAttempt(email, req.ip);
  
      const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
  
      if (!user) {
        logger.auth.loginFailure(email, 'User not found', req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      const passwordValid = await comparePassword(password, user.password_hash);
      if (!passwordValid) {
        logger.auth.loginFailure(email, 'Invalid password', req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      // Login successful
      logger.auth.loginSuccess(user, req.ip);
  
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      logger.error('AUTH', 'Login error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, name, password } = req.body;
  
      // Validate required fields
      if (!email || !name || !password) {
        return res.status(400).json({ error: 'Email, name, and password are required' });
      }
  
      const hash = await hashPassword(password);
      const result = await dbRun('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)', [email, name, hash]);
  
      // Log user registration in audit log
      await dbRun(
        'INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values, description, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          result.lastID,
          email,
          'CREATE',
          'users',
          result.lastID,
          JSON.stringify({ email, name, role: 'editor' }),
          `User registered: ${email}`,
          req.ip
        ]
      );
  
      res.json({ id: result.lastID, email, name });
    } catch (err) {
      // Check if it's a duplicate key error
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        if (err.message.includes('users.email')) {
          return res.status(400).json({ error: 'A user with this email already exists' });
        } else if (err.message.includes('users.name') || err.message.includes('idx_users_name')) {
          return res.status(400).json({ error: 'A user with this name already exists. Please choose a different name.' });
        }
        return res.status(400).json({ error: 'User already exists' });
      }
      console.error('Registration error:', err);
      res.status(400).json({ error: err.message || 'Registration failed' });
    }
  });
  
  app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
      // Log the logout event
      logger.auth.logout(req.user.userId, req.user.email);
  
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      logger.exception('AUTH', 'Error during logout', err, { userId: req.user?.userId });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
  
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
  
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
  
      // Get user from database
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Verify current password
      if (!(await comparePassword(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
  
      // Hash new password
      const newHash = await hashPassword(newPassword);
  
      // Update password
      await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
  
      // Log audit entry
      await logAudit(
        { id: userId, email: user.email },
        'UPDATE',
        'users',
        userId,
        { action: 'password_change' },
        { action: 'password_changed' },
        `User ${user.email} changed their password`,
        req.ip
      );
  
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });
  
  app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await dbGet('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [userId]);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = req.user.userId;
  
      // Validate input
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
  
      // Get current user info
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Check if email is already taken by another user
      if (email !== user.email) {
        const existingUser = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already in use by another account' });
        }
      }
  
      // Update profile
      await dbRun('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId]);
  
      // Log audit entry
      await logAudit(
        { id: userId, email: user.email },
        'UPDATE',
        'users',
        userId,
        { name: user.name, email: user.email },
        { name, email },
        `User updated profile`,
        req.ip
      );
  
      // Return updated user info
      res.json({ id: userId, name, email, role: user.role });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });
  
  // ===== PORTFOLIOS =====
  app.get('/api/portfolios', async (req, res) => {
    try {
      const portfolios = await dbAll('SELECT * FROM portfolios ORDER BY display_order, name');
      res.json(portfolios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/portfolios', authenticateToken, async (req, res) => {
    try {
      const { name, description, color, display_order } = req.body;
  
      if (!name) {
        return res.status(400).json({ error: 'Portfolio name is required' });
      }
  
      // Check if user has permission to create portfolios (admin only)
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can create portfolios' });
      }
  
      const result = await dbRun(
        'INSERT INTO portfolios (name, description, color, display_order) VALUES (?, ?, ?, ?)',
        [name, description || null, color || '#3b82f6', display_order || 0]
      );
  
      await logAudit(
        req.user,
        'CREATE',
        'portfolios',
        result.lastID,
        null,
        { name, description, color, display_order },
        `Created portfolio: ${name}`,
        req.ip
      );
  
      logger.asset.create(req.user, 'portfolio', { name, description, color }, null);
  
      res.status(201).json({ id: result.lastID, name, description, color, display_order });
    } catch (err) {
      logger.exception('PORTFOLIO', 'Error creating portfolio', err, { requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/portfolios/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, display_order } = req.body;
  
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can update portfolios' });
      }
  
      const oldPortfolio = await dbGet('SELECT * FROM portfolios WHERE id = ?', [id]);
      if (!oldPortfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
  
      await dbRun(
        'UPDATE portfolios SET name = ?, description = ?, color = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description, color, display_order, id]
      );
  
      await logAudit(
        req.user,
        'UPDATE',
        'portfolios',
        id,
        oldPortfolio,
        { name, description, color, display_order },
        `Updated portfolio: ${name}`,
        req.ip
      );
  
      res.json({ id, name, description, color, display_order });
    } catch (err) {
      console.error('Update portfolio error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/portfolios/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can delete portfolios' });
      }
  
      const portfolio = await dbGet('SELECT * FROM portfolios WHERE id = ?', [id]);
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
  
      // Set portfolio_id to NULL for all projects in this portfolio
      await dbRun('UPDATE projects SET portfolio_id = NULL WHERE portfolio_id = ?', [id]);
  
      await dbRun('DELETE FROM portfolios WHERE id = ?', [id]);
  
      await logAudit(
        req.user,
        'DELETE',
        'portfolios',
        id,
        portfolio,
        null,
        `Deleted portfolio: ${portfolio.name}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      console.error('Delete portfolio error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Portfolio Status Report - Available to all users (no auth required)
  app.get('/api/portfolios/:id/report', async (req, res) => {
    try {
      const { id } = req.params;

      // Get portfolio info
      const portfolio = await dbGet('SELECT * FROM portfolios WHERE id = ?', [id]);
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      // Get all projects in this portfolio with their metrics
      const projects = await dbAll(`
        SELECT p.id, p.name, p.description, p.initiative_manager, p.start_date, p.end_date
        FROM projects p
        WHERE p.portfolio_id = ?
        ORDER BY p.name
      `, [id]);

      const projectsWithMetrics = [];

      for (const project of projects) {
        // Get all metrics for this project
        const metrics = await dbAll(`
          SELECT m.id, m.name, m.amber_tolerance, m.red_tolerance, m.start_date, m.end_date
          FROM metrics m
          WHERE m.project_id = ?
          ORDER BY m.name
        `, [project.id]);

        const metricsWithStatus = [];

        for (const metric of metrics) {
          // Get all periods for this metric, sorted by date
          const periods = await dbAll(`
            SELECT mp.id, mp.reporting_date, mp.complete, mp.expected, mp.target
            FROM metric_periods mp
            WHERE mp.metric_id = ?
            ORDER BY mp.reporting_date ASC
          `, [metric.id]);

          if (periods.length === 0) continue;

          // Find the current period (period has started but next period hasn't started yet)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let currentPeriod = null;
          for (let i = 0; i < periods.length; i++) {
            const periodStart = new Date(periods[i].reporting_date);
            periodStart.setHours(0, 0, 0, 0);

            // Check if this period has started
            if (periodStart <= today) {
              // Check if next period has started
              if (i + 1 < periods.length) {
                const nextPeriodStart = new Date(periods[i + 1].reporting_date);
                nextPeriodStart.setHours(0, 0, 0, 0);
                if (today < nextPeriodStart) {
                  // We're in this period (started but next hasn't started)
                  currentPeriod = periods[i];
                  break;
                }
              } else {
                // This is the last period and it has started
                currentPeriod = periods[i];
              }
            }
          }

          // Calculate RAG status
          let ragStatus = 'grey';
          let variance = 0;
          let variancePercent = 0;

          // If no current period found (all periods are in the future), show as grey
          if (!currentPeriod) {
            // Use the first period for display but show grey status
            const firstPeriod = periods[0];
            metricsWithStatus.push({
              id: metric.id,
              name: metric.name,
              ragStatus: 'grey',
              variance: 0,
              variancePercent: 0,
              complete: firstPeriod.complete || 0,
              expected: firstPeriod.expected || 0,
              reporting_date: firstPeriod.reporting_date,
              latestComment: null
            });
            continue;
          }

          // Check if we're still in the current period (haven't passed to next period yet)
          // Find the index of current period
          const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriod.id);

          // We're in the current period if:
          // 1. There's a next period and we haven't reached it yet, OR
          // Check if we're still in the current period (next period hasn't started yet)
          // This matches the frontend logic in MetricTabs.jsx exactly
          const isInCurrentPeriod = currentPeriodIndex === periods.length - 1 ||
            today < new Date(periods[currentPeriodIndex + 1].reporting_date);

          // Helper function to calculate RAG for a specific period
          const calculateRAGForPeriod = (period) => {
            if (period.complete === null || period.expected === null) {
              return { ragStatus: 'grey', variance: 0, variancePercent: 0 };
            }

            const periodVariance = period.complete - period.expected;
            const periodVariancePercent = period.expected > 0
              ? Math.abs((periodVariance / period.expected) * 100)
              : 0;

            const amberTolerance = parseFloat(metric.amber_tolerance) || 5.0;
            const redTolerance = parseFloat(metric.red_tolerance) || 10.0;

            let status = 'grey';
            if (period.expected === 0) {
              status = 'grey';
            } else if (periodVariance >= 0) {
              status = 'green';
            } else if (periodVariancePercent > redTolerance) {
              status = 'red';
            } else if (periodVariancePercent > amberTolerance) {
              status = 'amber';
            } else {
              status = 'green';
            }

            return { ragStatus: status, variance: periodVariance, variancePercent: periodVariancePercent };
          };

          // If we're in the current period and it has no data, use previous period's status
          if (isInCurrentPeriod) {
            const currentComplete = currentPeriod.complete || 0;

            // If current period has no meaningful data (complete is 0 or null), use previous period
            if (currentComplete === 0 && currentPeriodIndex > 0) {
              const previousPeriod = periods[currentPeriodIndex - 1];
              const previousRAG = calculateRAGForPeriod(previousPeriod);
              ragStatus = previousRAG.ragStatus;
              variance = previousRAG.variance;
              variancePercent = previousRAG.variancePercent;
            } else {
              // Current period has data - calculate its RAG
              const currentRAG = calculateRAGForPeriod(currentPeriod);
              ragStatus = currentRAG.ragStatus;
              variance = currentRAG.variance;
              variancePercent = currentRAG.variancePercent;
            }
          } else {
            // For completed periods, calculate normally
            const periodRAG = calculateRAGForPeriod(currentPeriod);
            ragStatus = periodRAG.ragStatus;
            variance = periodRAG.variance;
            variancePercent = periodRAG.variancePercent;
          }

          // Get latest comment for this period (for red and amber metrics)
          let latestComment = null;
          if (ragStatus === 'red' || ragStatus === 'amber') {
            const comments = await dbAll(`
              SELECT comment_text, created_at, created_by
              FROM comments
              WHERE period_id = ?
              ORDER BY created_at DESC
              LIMIT 1
            `, [currentPeriod.id]);

            if (comments.length > 0) {
              latestComment = comments[0];
            }
          }

          metricsWithStatus.push({
            id: metric.id,
            name: metric.name,
            ragStatus,
            variance,
            variancePercent,
            complete: currentPeriod.complete,
            expected: currentPeriod.expected,
            reporting_date: currentPeriod.reporting_date,
            latestComment
          });
        }

        // Only include projects that have metrics
        if (metricsWithStatus.length > 0) {
          // Sort metrics by variance (ascending, so most negative/worst first)
          metricsWithStatus.sort((a, b) => a.variance - b.variance);

          projectsWithMetrics.push({
            id: project.id,
            name: project.name,
            description: project.description,
            initiative_manager: project.initiative_manager,
            start_date: project.start_date,
            end_date: project.end_date,
            metrics: metricsWithStatus
          });
        }
      }

      // Group projects by worst RAG status
      const redProjects = projectsWithMetrics.filter(p =>
        p.metrics.some(m => m.ragStatus === 'red')
      );
      const amberProjects = projectsWithMetrics.filter(p =>
        p.metrics.some(m => m.ragStatus === 'amber') &&
        !p.metrics.some(m => m.ragStatus === 'red')
      );
      const greenProjects = projectsWithMetrics.filter(p =>
        p.metrics.every(m => m.ragStatus === 'green' || m.ragStatus === 'grey')
      );

      // Summary statistics
      const summary = {
        totalProjects: projectsWithMetrics.length,
        redCount: redProjects.length,
        amberCount: amberProjects.length,
        greenCount: greenProjects.length,
        totalMetrics: projectsWithMetrics.reduce((sum, p) => sum + p.metrics.length, 0)
      };

      res.json({
        portfolio,
        summary,
        redProjects,
        amberProjects,
        greenProjects
      });
    } catch (err) {
      console.error('Portfolio report error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== FEEDBACK =====
  app.get('/api/feedback', async (req, res) => {
    try {
      const { status, project_id } = req.query;
      let query = `
        SELECT f.*,
               u.name as user_name,
               u.email as user_email,
               r.name as responder_name,
               s.name as resolver_name
        FROM feedback f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN users r ON f.responded_by = r.id
        LEFT JOIN users s ON f.resolved_by = s.id
      `;
      let params = [];
      let conditions = [];

      if (project_id) {
        conditions.push('f.project_id = ?');
        params.push(project_id);
      }

      if (status) {
        conditions.push('f.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY f.created_at DESC';

      const feedback = await dbAll(query, params);
      res.json(feedback);
    } catch (err) {
      console.error('Get feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/feedback', authenticateToken, async (req, res) => {
    try {
      const { text, project_id } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Feedback text is required' });
      }

      if (!project_id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const result = await dbRun(
        `INSERT INTO feedback (user_id, text, status, project_id)
         VALUES (?, ?, 'open', ?)`,
        [req.user.userId, text.trim(), project_id]
      );

      const newFeedback = await dbGet(
        `SELECT f.*,
                u.name as user_name,
                u.email as user_email
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         WHERE f.id = ?`,
        [result.lastID]
      );

      await logAudit(
        req.user,
        'CREATE',
        'feedback',
        result.lastID,
        null,
        newFeedback,
        `Created feedback: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        req.ip
      );

      res.status(201).json(newFeedback);
    } catch (err) {
      console.error('Create feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/feedback/:id/respond', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { pm_response } = req.body;

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can respond to feedback' });
      }

      if (!pm_response) {
        return res.status(400).json({ error: 'Response text is required' });
      }

      const feedback = await dbGet('SELECT * FROM feedback WHERE id = ?', [id]);
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      await dbRun(
        `UPDATE feedback
         SET pm_response = ?,
             responded_by = ?,
             responded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [pm_response, req.user.userId, id]
      );

      const updatedFeedback = await dbGet(
        `SELECT f.*,
                u.name as user_name,
                u.email as user_email,
                r.name as responder_name
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN users r ON f.responded_by = r.id
         WHERE f.id = ?`,
        [id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'feedback',
        id,
        feedback,
        updatedFeedback,
        `Responded to feedback: ${feedback.title}`,
        req.ip
      );

      res.json(updatedFeedback);
    } catch (err) {
      console.error('Respond to feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/feedback/:id/resolve', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { resolved } = req.body; // true to resolve, false to reopen

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can resolve feedback' });
      }

      const feedback = await dbGet('SELECT * FROM feedback WHERE id = ?', [id]);
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      const newStatus = resolved ? 'resolved' : 'open';
      const resolvedBy = resolved ? req.user.userId : null;
      const resolvedAt = resolved ? 'CURRENT_TIMESTAMP' : null;

      await dbRun(
        `UPDATE feedback
         SET status = ?,
             resolved_by = ?,
             resolved_at = ${resolvedAt ? resolvedAt : 'NULL'},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, resolvedBy, id]
      );

      const updatedFeedback = await dbGet(
        `SELECT f.*,
                u.name as user_name,
                u.email as user_email,
                r.name as responder_name,
                s.name as resolver_name
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN users r ON f.responded_by = r.id
         LEFT JOIN users s ON f.resolved_by = s.id
         WHERE f.id = ?`,
        [id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'feedback',
        id,
        feedback,
        updatedFeedback,
        `${resolved ? 'Resolved' : 'Reopened'} feedback: ${feedback.title}`,
        req.ip
      );

      res.json(updatedFeedback);
    } catch (err) {
      console.error('Resolve feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Edit feedback text (user can only edit their own)
  app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Feedback text is required' });
      }

      const feedback = await dbGet('SELECT * FROM feedback WHERE id = ?', [id]);
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      // Only the feedback creator can edit it
      if (feedback.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only edit your own feedback' });
      }

      await dbRun(
        `UPDATE feedback
         SET text = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [text.trim(), id]
      );

      const updatedFeedback = await dbGet(
        `SELECT f.*,
                u.name as user_name,
                u.email as user_email,
                r.name as responder_name,
                s.name as resolver_name
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN users r ON f.responded_by = r.id
         LEFT JOIN users s ON f.resolved_by = s.id
         WHERE f.id = ?`,
        [id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'feedback',
        id,
        feedback,
        updatedFeedback,
        `Edited feedback text`,
        req.ip
      );

      res.json(updatedFeedback);
    } catch (err) {
      console.error('Edit feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Edit PM response (PMs only)
  app.put('/api/feedback/:id/edit-response', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { pm_response } = req.body;

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can edit responses' });
      }

      if (!pm_response || !pm_response.trim()) {
        return res.status(400).json({ error: 'Response text is required' });
      }

      const feedback = await dbGet('SELECT * FROM feedback WHERE id = ?', [id]);
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      if (!feedback.pm_response) {
        return res.status(400).json({ error: 'No response exists to edit' });
      }

      await dbRun(
        `UPDATE feedback
         SET pm_response = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [pm_response.trim(), id]
      );

      const updatedFeedback = await dbGet(
        `SELECT f.*,
                u.name as user_name,
                u.email as user_email,
                r.name as responder_name,
                s.name as resolver_name
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN users r ON f.responded_by = r.id
         LEFT JOIN users s ON f.resolved_by = s.id
         WHERE f.id = ?`,
        [id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'feedback',
        id,
        feedback,
        updatedFeedback,
        `Edited PM response to feedback`,
        req.ip
      );

      res.json(updatedFeedback);
    } catch (err) {
      console.error('Edit response error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== RECOVERY PLANS (Return to Green) =====

  // Get recovery plans for a metric or project
  app.get('/api/recovery-plans', authenticateToken, async (req, res) => {
    try {
      const { metric_id, project_id, status } = req.query;

      let query = `
        SELECT rp.*,
               u.name as creator_name,
               m.name as metric_name,
               p.name as project_name
        FROM recovery_plans rp
        LEFT JOIN users u ON rp.created_by = u.id
        LEFT JOIN metrics m ON rp.metric_id = m.id
        LEFT JOIN projects p ON rp.project_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (metric_id) {
        query += ' AND rp.metric_id = ?';
        params.push(metric_id);
      }

      if (project_id) {
        query += ' AND rp.project_id = ?';
        params.push(project_id);
      }

      if (status) {
        query += ' AND rp.status = ?';
        params.push(status);
      }

      query += ' ORDER BY rp.created_at DESC';

      const plans = await dbAll(query, params);
      res.json(plans);
    } catch (err) {
      console.error('Get recovery plans error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new recovery plan
  app.post('/api/recovery-plans', authenticateToken, async (req, res) => {
    try {
      const { metric_id, project_id, plan_text, target_recovery_date } = req.body;

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can create recovery plans' });
      }

      if (!metric_id || !project_id || !plan_text) {
        return res.status(400).json({ error: 'metric_id, project_id, and plan_text are required' });
      }

      const result = await dbRun(
        `INSERT INTO recovery_plans (metric_id, project_id, plan_text, target_recovery_date, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [metric_id, project_id, plan_text, target_recovery_date || null, req.user.userId]
      );

      const newPlan = await dbGet(
        `SELECT rp.*,
                u.name as creator_name,
                m.name as metric_name,
                p.name as project_name
         FROM recovery_plans rp
         LEFT JOIN users u ON rp.created_by = u.id
         LEFT JOIN metrics m ON rp.metric_id = m.id
         LEFT JOIN projects p ON rp.project_id = p.id
         WHERE rp.id = ?`,
        [result.lastID]
      );

      // Audit log
      await logAudit(
        req.user.userId,
        'CREATE',
        'recovery_plans',
        result.lastID,
        null,
        JSON.stringify(newPlan),
        req.ip
      );

      res.json(newPlan);
    } catch (err) {
      console.error('Create recovery plan error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update a recovery plan
  app.put('/api/recovery-plans/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { plan_text, target_recovery_date, status, completion_notes } = req.body;

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can update recovery plans' });
      }

      const existingPlan = await dbGet('SELECT * FROM recovery_plans WHERE id = ?', [id]);
      if (!existingPlan) {
        return res.status(404).json({ error: 'Recovery plan not found' });
      }

      const updates = [];
      const params = [];

      if (plan_text !== undefined) {
        updates.push('plan_text = ?');
        params.push(plan_text);
      }

      if (target_recovery_date !== undefined) {
        updates.push('target_recovery_date = ?');
        params.push(target_recovery_date);
      }

      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);

        if (status === 'completed' || status === 'cancelled') {
          updates.push('completed_at = CURRENT_TIMESTAMP');
        }
      }

      if (completion_notes !== undefined) {
        updates.push('completion_notes = ?');
        params.push(completion_notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(id);

      await dbRun(
        `UPDATE recovery_plans SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      const updatedPlan = await dbGet(
        `SELECT rp.*,
                u.name as creator_name,
                m.name as metric_name,
                p.name as project_name
         FROM recovery_plans rp
         LEFT JOIN users u ON rp.created_by = u.id
         LEFT JOIN metrics m ON rp.metric_id = m.id
         LEFT JOIN projects p ON rp.project_id = p.id
         WHERE rp.id = ?`,
        [id]
      );

      // Audit log
      await logAudit(
        req.user.userId,
        'UPDATE',
        'recovery_plans',
        id,
        JSON.stringify(existingPlan),
        JSON.stringify(updatedPlan),
        req.ip
      );

      res.json(updatedPlan);
    } catch (err) {
      console.error('Update recovery plan error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a recovery plan
  app.delete('/api/recovery-plans/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      if (!isPMOrAbove(req.user)) {
        return res.status(403).json({ error: 'Only PMs and admins can delete recovery plans' });
      }

      const existingPlan = await dbGet('SELECT * FROM recovery_plans WHERE id = ?', [id]);
      if (!existingPlan) {
        return res.status(404).json({ error: 'Recovery plan not found' });
      }

      await dbRun('DELETE FROM recovery_plans WHERE id = ?', [id]);

      // Audit log
      await logAudit(
        req.user.userId,
        'DELETE',
        'recovery_plans',
        id,
        JSON.stringify(existingPlan),
        null,
        req.ip
      );

      res.json({ message: 'Recovery plan deleted successfully' });
    } catch (err) {
      console.error('Delete recovery plan error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== PROJECTS =====
  app.get('/api/projects', async (req, res) => {
    try {
      const { portfolio_id } = req.query;
      let query = 'SELECT p.*, po.name as portfolio_name, po.color as portfolio_color FROM projects p LEFT JOIN portfolios po ON p.portfolio_id = po.id';
      let params = [];

      if (portfolio_id) {
        query += ' WHERE p.portfolio_id = ?';
        params.push(portfolio_id);
      }

      query += ' ORDER BY p.created_at DESC';

      const projects = await dbAll(query, params);
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const project = await dbGet(
        'SELECT p.*, po.name as portfolio_name, po.color as portfolio_color FROM projects p LEFT JOIN portfolios po ON p.portfolio_id = po.id WHERE p.id = ?',
        [req.params.id]
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects', authenticateToken, async (req, res) => {
    try {
      // Verify user is authenticated
      if (!req.user) {
        logger.warn('PROJECT', 'Project creation attempt without authentication');
        return res.status(401).json({ error: 'User not authenticated' });
      }
  
      const { name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id } = req.body;
      const projectData = { name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id };

      // Log project creation attempt
      logger.project.createAttempt(req.user, projectData);

      // Check if user can create projects (using role from JWT token)
      if (!canCreateProject(req.user)) {
        logger.project.createFailure(req.user, projectData, 'Permission denied - insufficient role');
        return res.status(403).json({ error: 'You do not have permission to create projects' });
      }

      // Validate initiative managers are real users
      if (initiative_manager && initiative_manager.trim()) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [initiative_manager.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Primary initiative manager "${initiative_manager}" is not a registered user` });
        }
      }
      if (secondary_pm && secondary_pm.trim()) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [secondary_pm.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Secondary initiative manager "${secondary_pm}" is not a registered user` });
        }
      }

      const result = await dbRun(
        'INSERT INTO projects (name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, description, initiative_manager || null, secondary_pm || null, start_date || null, end_date || null, portfolio_id || null]
      );

      // Auto-grant permission to the creating user if they are a PM or Editor
      if (req.user.role === ROLES.PM || req.user.role === ROLES.EDITOR) {
        await dbRun(
          'INSERT INTO project_permissions (project_id, user_id) VALUES (?, ?)',
          [result.lastID, req.user.userId]
        );
        logger.debug('PROJECT', `Auto-granted permission to user ${req.user.email} for project ${result.lastID}`);
      }

      // Grant permissions to initiative managers
      await grantPermissionsToInitiativeManagers(result.lastID, initiative_manager, secondary_pm);

      await logAudit(req.user, 'CREATE', 'projects', result.lastID, null,
        { name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id },
        `Created project "${name}"`,
        req.ip
      );

      // Log successful creation
      logger.project.createSuccess(req.user, result.lastID, projectData);

      res.json({ id: result.lastID, name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id });
    } catch (err) {
      logger.project.createFailure(req.user, req.body, err.message);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this project' });
      }
  
      const { name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id } = req.body;
      const oldProject = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);

      // Validate initiative managers are real users
      if (initiative_manager && initiative_manager.trim()) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [initiative_manager.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Primary initiative manager "${initiative_manager}" is not a registered user` });
        }
      }
      if (secondary_pm && secondary_pm.trim()) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [secondary_pm.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Secondary initiative manager "${secondary_pm}" is not a registered user` });
        }
      }

      await dbRun(
        'UPDATE projects SET name = ?, description = ?, initiative_manager = ?, secondary_pm = ?, start_date = ?, end_date = ?, portfolio_id = ? WHERE id = ?',
        [name, description, initiative_manager || null, secondary_pm || null, start_date || null, end_date || null, portfolio_id || null, req.params.id]
      );

      // Grant permissions to new initiative managers
      await grantPermissionsToInitiativeManagers(req.params.id, initiative_manager, secondary_pm);

      await logAudit(req.user, 'UPDATE', 'projects', req.params.id,
        { name: oldProject.name, description: oldProject.description, initiative_manager: oldProject.initiative_manager, secondary_pm: oldProject.secondary_pm, start_date: oldProject.start_date, end_date: oldProject.end_date, portfolio_id: oldProject.portfolio_id },
        { name, description, initiative_manager, secondary_pm, start_date, end_date, portfolio_id },
        `Updated project "${name}"`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this project' });
      }

      const oldProject = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);

      if (!oldProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Cascade delete: delete all related data first

      // 1. Delete metric periods for all metrics in this project
      await dbRun(`
        DELETE FROM metric_periods
        WHERE metric_id IN (SELECT id FROM metrics WHERE project_id = ?)
      `, [req.params.id]);

      // 2. Delete comments for all metrics in this project
      await dbRun(`
        DELETE FROM comments
        WHERE period_id IN (
          SELECT mp.id FROM metric_periods mp
          JOIN metrics m ON mp.metric_id = m.id
          WHERE m.project_id = ?
        )
      `, [req.params.id]);

      // 3. Delete recovery plans for all metrics in this project
      await dbRun(`
        DELETE FROM recovery_plans
        WHERE metric_id IN (SELECT id FROM metrics WHERE project_id = ?)
      `, [req.params.id]);

      // 4. Delete metrics
      await dbRun('DELETE FROM metrics WHERE project_id = ?', [req.params.id]);

      // 5. Delete project links
      await dbRun('DELETE FROM project_links WHERE project_id = ?', [req.params.id]);

      // 6. Delete project permissions
      await dbRun('DELETE FROM project_permissions WHERE project_id = ?', [req.params.id]);

      // 7. Delete feedback for this project
      await dbRun('DELETE FROM feedback WHERE project_id = ?', [req.params.id]);

      // 8. Finally delete the project
      await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);

      await logAudit(req.user, 'DELETE', 'projects', req.params.id,
        { name: oldProject.name, description: oldProject.description },
        null,
        `Deleted project "${oldProject.name}"`,
        req.ip
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting project:', err);
      res.status(500).json({
        error: `Failed to delete project: ${err.message}. This may be due to database constraints or related data.`
      });
    }
  });
  
  // ===== PROJECT LINKS =====
  // Get all links for a project
  app.get('/api/projects/:projectId/links', async (req, res) => {
    try {
      const links = await dbAll(
        'SELECT * FROM project_links WHERE project_id = ? ORDER BY display_order, id',
        [req.params.projectId]
      );
      res.json(links);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Create a new project link
  app.post('/api/projects/:projectId/links', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to add links to this project' });
      }
  
      const { label, url, display_order = 0 } = req.body;
  
      if (!label || !url) {
        return res.status(400).json({ error: 'Label and URL are required' });
      }
  
      const linkData = { label, url, display_order };
  
      const result = await dbRun(
        'INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)',
        [req.params.projectId, label, url, display_order]
      );
  
      await logAudit(req.user, 'CREATE', 'project_links', result.lastID,
        null,
        { project_id: req.params.projectId, label, url, display_order },
        `Added link "${label}" to project`,
        req.ip
      );
  
      logger.asset.create(req.user, 'project_link', linkData, req.params.projectId);
  
      res.json({ success: true, id: result.lastID });
    } catch (err) {
      logger.asset.createFailure(req.user, 'project_link', req.body, err.message, req.params.projectId);
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update a project link
  app.put('/api/project-links/:id', authenticateToken, async (req, res) => {
    try {
      const link = await dbGet('SELECT * FROM project_links WHERE id = ?', [req.params.id]);
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, link.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this link' });
      }
  
      const { label, url, display_order } = req.body;
  
      await dbRun(
        'UPDATE project_links SET label = ?, url = ?, display_order = ? WHERE id = ?',
        [label, url, display_order, req.params.id]
      );
  
      await logAudit(req.user, 'UPDATE', 'project_links', req.params.id,
        { label: link.label, url: link.url, display_order: link.display_order },
        { label, url, display_order },
        `Updated link "${label}"`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Delete a project link
  app.delete('/api/project-links/:id', authenticateToken, async (req, res) => {
    try {
      const link = await dbGet('SELECT * FROM project_links WHERE id = ?', [req.params.id]);
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, link.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this link' });
      }
  
      await dbRun('DELETE FROM project_links WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'project_links', req.params.id,
        { label: link.label, url: link.url },
        null,
        `Deleted link "${link.label}"`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== METRICS =====
  app.get('/api/projects/:projectId/metrics', async (req, res) => {
    try {
      const metrics = await dbAll('SELECT * FROM metrics WHERE project_id = ?', [req.params.projectId]);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/projects/:projectId/metrics', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to add metrics to this project' });
      }
  
      const { name, description, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type } = req.body;
  
      // Verify project exists first
      const project = await dbGet('SELECT id, initiative_manager FROM projects WHERE id = ?', [req.params.projectId]);
      if (!project) {
        return res.status(404).json({ error: `Project with ID ${req.params.projectId} not found` });
      }
  
      // If no owner_id provided, default to current user
      let finalOwnerId = owner_id;
  
      if (!finalOwnerId) {
        // Try to use a user ID that matches the initiative_manager
        if (project.initiative_manager) {
          // Try to find a user with this name
          const user = await dbGet('SELECT id FROM users WHERE name = ?', [project.initiative_manager]);
          if (user) {
            finalOwnerId = user.id;
          }
        }
  
        // If still no owner, use the current logged-in user
        if (!finalOwnerId) {
          finalOwnerId = req.user.id;
        }
      }
  
      console.log('Creating metric:', {
        projectId: req.params.projectId,
        name,
        description,
        owner_id: finalOwnerId,
        start_date,
        end_date,
        frequency,
        progression_type,
        final_target
      });

      const result = await dbRun(`
        INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.params.projectId, name, description || null, finalOwnerId, start_date, end_date, frequency, progression_type || 'linear', final_target, amber_tolerance || 5.0, red_tolerance || 10.0, metric_type || 'lead']);
  
      console.log('Metric created with ID:', result.lastID);
  
      // Auto-generate periods
      console.log('Generating periods...');
      await generateMetricPeriods(result.lastID, start_date, end_date, frequency, progression_type || 'linear', final_target, dbRun);

      console.log('Periods generated successfully');
  
      await logAudit(req.user, 'CREATE', 'metrics', result.lastID, null,
        { name, description, owner_id: finalOwnerId, start_date, end_date, frequency, progression_type: progression_type || 'linear', final_target },
        `Created metric "${name}" for project ID ${req.params.projectId}`,
        req.ip
      );

      logger.asset.create(req.user, 'metric', { name, description, owner_id: finalOwnerId, start_date, end_date, frequency, final_target }, req.params.projectId);
  
      res.json({ id: result.lastID });
    } catch (err) {
      logger.exception('METRIC', 'Error creating metric', err, { projectId: req.params.projectId, requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/metrics/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this metric
      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [req.params.id]);
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, metric.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this metric' });
      }
  
      // Extract all editable fields from request body
      const { name, description, amber_tolerance, red_tolerance, final_target, progression_type, metric_type, start_date, end_date, recalculate_expected } = req.body;

      // Build update query for provided fields
      const updates = [];
      const values = [];
      const oldValues = {};
      const newValues = {};

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
        oldValues.name = metric.name;
        newValues.name = name;
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
        oldValues.description = metric.description;
        newValues.description = description;
      }
      if (amber_tolerance !== undefined) {
        updates.push('amber_tolerance = ?');
        values.push(amber_tolerance);
        oldValues.amber_tolerance = metric.amber_tolerance;
        newValues.amber_tolerance = amber_tolerance;
      }
      if (red_tolerance !== undefined) {
        updates.push('red_tolerance = ?');
        values.push(red_tolerance);
        oldValues.red_tolerance = metric.red_tolerance;
        newValues.red_tolerance = red_tolerance;
      }
      if (final_target !== undefined) {
        updates.push('final_target = ?');
        values.push(final_target);
        oldValues.final_target = metric.final_target;
        newValues.final_target = final_target;
      }
      if (progression_type !== undefined) {
        updates.push('progression_type = ?');
        values.push(progression_type);
        oldValues.progression_type = metric.progression_type;
        newValues.progression_type = progression_type;
      }
      if (metric_type !== undefined) {
        updates.push('metric_type = ?');
        values.push(metric_type);
        oldValues.metric_type = metric.metric_type;
        newValues.metric_type = metric_type;
      }
      if (start_date !== undefined) {
        updates.push('start_date = ?');
        values.push(start_date);
        oldValues.start_date = metric.start_date;
        newValues.start_date = start_date;
      }
      if (end_date !== undefined) {
        updates.push('end_date = ?');
        values.push(end_date);
        oldValues.end_date = metric.end_date;
        newValues.end_date = end_date;
      }
  
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
  
      values.push(req.params.id);
      await dbRun(`UPDATE metrics SET ${updates.join(', ')} WHERE id = ?`, values);

      // If final_target or progression_type changed, recalculate expected values
      // recalculate_expected can be: 'all', 'future', or 'none'
      if ((final_target !== undefined || progression_type !== undefined) && recalculate_expected !== 'none') {
        const updatedMetric = await dbGet('SELECT * FROM metrics WHERE id = ?', [req.params.id]);
        const periods = await dbAll(
          'SELECT id, reporting_date FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date ASC',
          [req.params.id]
        );

        const totalPeriods = periods.length;
        const today = new Date().toISOString().split('T')[0];

        for (let i = 0; i < periods.length; i++) {
          // If recalculate_expected is 'future', only update periods after today
          if (recalculate_expected === 'future' && periods[i].reporting_date <= today) {
            // Only update the target for past/current periods, not the expected value
            await dbRun(
              'UPDATE metric_periods SET target = ? WHERE id = ?',
              [updatedMetric.final_target, periods[i].id]
            );
            continue;
          }

          const expected = calculateExpectedValue(
            updatedMetric.progression_type,
            updatedMetric.final_target,
            i + 1,
            totalPeriods
          );
          await dbRun(
            'UPDATE metric_periods SET expected = ?, target = ? WHERE id = ?',
            [expected, updatedMetric.final_target, periods[i].id]
          );
        }
      }

      await logAudit(req.user, 'UPDATE', 'metrics', req.params.id,
        oldValues,
        newValues,
        `Updated metric "${metric.name}"`,
        req.ip
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/metrics/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this metric
      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [req.params.id]);
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, metric.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this metric' });
      }
  
      await dbRun('DELETE FROM metrics WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'metrics', req.params.id,
        { name: metric.name, project_id: metric.project_id, owner_id: metric.owner_id },
        null,
        `Deleted metric "${metric.name}" from project ID ${metric.project_id}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== GET ALL METRICS FOR A PROJECT =====
  app.get('/api/projects/:projectId/metrics', async (req, res) => {
    try {
      const metrics = await dbAll(`
        SELECT
          m.id,
          m.name,
          m.description,
          m.project_id,
          m.start_date,
          m.end_date,
          m.frequency,
          m.progression_type,
          m.final_target,
          m.amber_tolerance,
          m.red_tolerance,
          m.metric_type,
          m.owner_id,
          u.name as owner_name
        FROM metrics m
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE m.project_id = ?
        ORDER BY m.name
      `, [req.params.projectId]);
  
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== PROJECT DATA (for grid view) =====
  app.get('/api/projects/:projectId/data', async (req, res) => {
    try {
      const data = await dbAll(`
        SELECT
          mp.id,
          mp.reporting_date,
          m.name as metric,
          m.description as metric_description,
          mp.expected,
          mp.target as final_target,
          m.final_target as metric_final_target,
          mp.complete,
          mp.commentary,
          m.id as metric_id,
          m.amber_tolerance,
          m.red_tolerance,
          m.start_date,
          m.end_date,
          m.frequency,
          m.progression_type,
          m.metric_type,
          p.name as initiative,
          u.name as owner,
          p.initiative_manager
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        JOIN projects p ON m.project_id = p.id
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE m.project_id = ?
        ORDER BY mp.reporting_date
      `, [req.params.projectId]);
  
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== METRIC PERIODS =====
  app.get('/api/metrics/:metricId/periods', async (req, res) => {
    try {
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [req.params.metricId]);
      res.json(periods);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/metric-periods', authenticateToken, async (req, res) => {
    try {
      const { metric_id, reporting_date, expected, target, complete } = req.body;
  
      // Get the project_id for this metric
      const metric = await dbGet('SELECT project_id, name FROM metrics WHERE id = ?', [metric_id]);
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, metric.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to add data to this project' });
      }
  
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [metric_id, reporting_date, expected, target, complete || 0]
      );
  
      await logAudit(req.user, 'CREATE', 'metric_periods', result.lastID, null,
        { metric_id, reporting_date, expected, target, complete: complete || 0 },
        `Created period for metric "${metric.name}" on ${reporting_date}`,
        req.ip
      );
  
      res.json({ id: result.lastID, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/metric-periods/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this period and old values
      const periodData = await dbGet(`
        SELECT mp.*, m.project_id, m.name as metric_name
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [req.params.id]);
      if (!periodData) {
        return res.status(404).json({ error: 'Period not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, periodData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this data' });
      }
  
      const { complete, expected, target } = req.body;
  
      // Check if this is a historic edit of completion values (period end date has passed)
      const periodEndDate = new Date(periodData.reporting_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isHistoricEdit = periodEndDate < today && complete !== undefined;

      // Only admins and PMs can make historic edits
      if (isHistoricEdit) {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
        if (!canEditHistoricData(user)) {
          return res.status(403).json({
            error: 'Historic edits of completion values are restricted to administrators and project managers only',
            isHistoricEdit: true
          });
        }
      }
  
      const updates = [];
      const params = [];
      const oldValues = {};
      const newValues = {};
  
      if (complete !== undefined) {
        updates.push('complete = ?');
        params.push(complete);
        oldValues.complete = periodData.complete;
        newValues.complete = complete;
      }
      if (expected !== undefined) {
        updates.push('expected = ?');
        params.push(expected);
        oldValues.expected = periodData.expected;
        newValues.expected = expected;
      }
      if (target !== undefined) {
        updates.push('target = ?');
        params.push(target);
        oldValues.target = periodData.target;
        newValues.target = target;
      }
  
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);
        await dbRun(`UPDATE metric_periods SET ${updates.join(', ')} WHERE id = ?`, params);
  
        // Mark historic edits clearly in audit log
        const description = isHistoricEdit
          ? `⚠️ HISTORIC EDIT: Updated complete value for metric "${periodData.metric_name}" on ${periodData.reporting_date} (period ended ${periodData.reporting_date})`
          : `Updated period for metric "${periodData.metric_name}" on ${periodData.reporting_date}`;
  
        await logAudit(req.user, 'UPDATE', 'metric_periods', req.params.id,
          oldValues,
          newValues,
          description,
          req.ip
        );
      }
  
      res.json({ success: true, isHistoricEdit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.patch('/api/metric-periods/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this period
      const periodData = await dbGet(`
        SELECT mp.*, m.project_id, m.name as metric_name
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [req.params.id]);
      if (!periodData) {
        return res.status(404).json({ error: 'Period not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, periodData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this data' });
      }
  
      const { complete, commentary } = req.body;

      // Check if this is a historic edit of completion values (period end date has passed)
      const periodEndDate = new Date(periodData.reporting_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isHistoricEdit = periodEndDate < today && complete !== undefined;

      // Only admins and PMs can make historic edits
      if (isHistoricEdit) {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
        if (!canEditHistoricData(user)) {
          return res.status(403).json({
            error: 'Historic edits of completion values are restricted to administrators and project managers only',
            isHistoricEdit: true
          });
        }
      }

      if (complete !== undefined) {
        await dbRun('UPDATE metric_periods SET complete = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [complete, req.params.id]);

        // Mark historic edits clearly in audit log
        const description = isHistoricEdit
          ? `⚠️ HISTORIC EDIT: Updated complete value for metric "${periodData.metric_name}" on ${periodData.reporting_date} (period ended ${periodData.reporting_date})`
          : `Updated complete value for metric "${periodData.metric_name}" on ${periodData.reporting_date}`;

        await logAudit(req.user, 'UPDATE', 'metric_periods', req.params.id,
          { complete: periodData.complete },
          { complete },
          description,
          req.ip
        );
      }

      // Handle commentary updates
      if (commentary !== undefined) {
        await dbRun('UPDATE metric_periods SET commentary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [commentary, req.params.id]);

        // Get project name for description
        const project = await dbGet('SELECT p.name FROM projects p JOIN metrics m ON p.id = m.project_id WHERE m.id = ?', [periodData.metric_id]);
        const projectName = project?.name || 'Unknown';

        await logAudit(req.user, 'UPDATE', 'metric_periods', req.params.id,
          { commentary: periodData.commentary },
          { commentary },
          `Updated metric period for Project: ${projectName}, Metric: ${periodData.metric_name}, Period: ${periodData.reporting_date}`,
          req.ip
        );
      }

      res.json({ success: true, isHistoricEdit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/metric-periods/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id and period details for this period
      const periodData = await dbGet(`
        SELECT mp.*, m.project_id, m.name as metric_name
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [req.params.id]);
  
      if (!periodData) {
        return res.status(404).json({ error: 'Period not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, periodData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this data' });
      }
  
      await dbRun('DELETE FROM metric_periods WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'metric_periods', req.params.id,
        {
          metric_id: periodData.metric_id,
          reporting_date: periodData.reporting_date,
          expected: periodData.expected,
          target: periodData.target,
          complete: periodData.complete
        },
        null,
        `Deleted period for metric "${periodData.metric_name}" on ${periodData.reporting_date}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting metric period:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== COMMENTS (for periods) =====

  // Get recent comments across all projects (for dashboard)
  app.get('/api/comments/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const comments = await dbAll(`
        SELECT
          c.id,
          c.comment_text,
          c.created_at,
          c.period_id,
          u.name as created_by_name,
          p.name as project_name,
          p.id as project_id,
          m.name as metric_name,
          mp.reporting_date
        FROM comments c
        LEFT JOIN users u ON c.created_by = u.id
        JOIN metric_periods mp ON c.period_id = mp.id
        JOIN metrics m ON mp.metric_id = m.id
        JOIN projects p ON m.project_id = p.id
        ORDER BY c.created_at DESC
        LIMIT ?
      `, [limit]);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/periods/:periodId/comments', async (req, res) => {
    try {
      const comments = await dbAll(`
        SELECT c.*, u.name as created_by_name
        FROM comments c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.period_id = ?
        ORDER BY c.created_at DESC
      `, [req.params.periodId]);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/periods/:periodId/comments', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this period
      const period = await dbGet(`
        SELECT m.project_id
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [req.params.periodId]);
      if (!period) {
        return res.status(404).json({ error: 'Period not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, period.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to add comments to this project' });
      }
  
      const { comment_text } = req.body;
      const result = await dbRun(
        'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
        [req.params.periodId, comment_text, req.user.userId]
      );
  
      await logAudit(req.user, 'CREATE', 'comments', result.lastID, null,
        { period_id: req.params.periodId, comment_text },
        `Added comment to period ID ${req.params.periodId}`,
        req.ip
      );
  
      logger.asset.create(req.user, 'comment', { comment_text }, req.params.periodId);
  
      res.json({ id: result.lastID });
    } catch (err) {
      logger.exception('COMMENT', 'Error creating comment', err, { periodId: req.params.periodId, requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/comments/:id', authenticateToken, async (req, res) => {
    try {
      const { comment_text } = req.body;
  
      if (!comment_text || !comment_text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
      }
  
      // Get the project_id and old comment text for this comment
      const commentData = await dbGet(`
        SELECT c.*, m.project_id
        FROM comments c
        JOIN metric_periods mp ON c.period_id = mp.id
        JOIN metrics m ON mp.metric_id = m.id
        WHERE c.id = ?
      `, [req.params.id]);
  
      if (!commentData) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, commentData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to update this comment' });
      }
  
      await dbRun(
        'UPDATE comments SET comment_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [comment_text, req.params.id]
      );
  
      await logAudit(req.user, 'UPDATE', 'comments', req.params.id,
        { comment_text: commentData.comment_text },
        { comment_text },
        `Updated comment on period ID ${commentData.period_id}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating comment:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this comment
      const commentData = await dbGet(`
        SELECT c.*, m.project_id
        FROM comments c
        JOIN metric_periods mp ON c.period_id = mp.id
        JOIN metrics m ON mp.metric_id = m.id
        WHERE c.id = ?
      `, [req.params.id]);
      if (!commentData) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, commentData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this comment' });
      }
  
      await dbRun('DELETE FROM comments WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'comments', req.params.id,
        { period_id: commentData.period_id, comment_text: commentData.comment_text },
        null,
        `Deleted comment from period ID ${commentData.period_id}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== CRAIDs (Comments, Risks, Actions, Issues, Dependencies) =====
  app.get('/api/projects/:projectId/craids', async (req, res) => {
    try {
      const { type } = req.query; // Optional filter by type
      let sql = `
        SELECT c.*, u.name as owner_name, u2.name as created_by_name, mp.reporting_date
        FROM craids c
        LEFT JOIN users u ON c.owner_id = u.id
        LEFT JOIN users u2 ON c.created_by = u2.id
        LEFT JOIN metric_periods mp ON c.period_id = mp.id
        WHERE c.project_id = ?
      `;
      const params = [req.params.projectId];
  
      if (type) {
        sql += ' AND c.type = ?';
        params.push(type);
      }
  
      sql += ' ORDER BY c.created_at DESC';
  
      const craids = await dbAll(sql, params);
      res.json(craids);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/projects/:projectId/craids', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to add items to this project' });
      }
  
      const { type, title, description, status, priority, owner_id, period_id } = req.body;
  
      // Validate required fields
      if (!type) {
        return res.status(400).json({ error: 'Type is required' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
  
      console.log('Creating CRAID:', {
        projectId: req.params.projectId,
        type,
        title,
        owner_id,
        period_id,
        created_by: req.user.id
      });
  
      const result = await dbRun(`
        INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.params.projectId, type, title, description, status || 'open', priority || 'medium', owner_id || null, period_id || null, req.user.id]);
  
      console.log('CRAID created successfully with ID:', result.lastID);
  
      await logAudit(req.user, 'CREATE', 'craids', result.lastID, null,
        { type, title, description, status: status || 'open', priority: priority || 'medium', owner_id, period_id },
        `Created ${type} "${title}" for project ID ${req.params.projectId}`,
        req.ip
      );
  
      logger.asset.create(req.user, `CRAID_${type}`, { title, description, status, priority }, req.params.projectId);
  
      res.json({ id: result.lastID });
    } catch (err) {
      logger.exception('CRAID', 'Error creating CRAID', err, { projectId: req.params.projectId, requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/craids/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this CRAID
      const craid = await dbGet('SELECT * FROM craids WHERE id = ?', [req.params.id]);
      if (!craid) {
        return res.status(404).json({ error: 'Item not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, craid.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this item' });
      }
  
      const { title, description, status, priority, owner_id } = req.body;
  
      // Validate title if provided
      if (title !== undefined && (!title || !title.trim())) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
  
      await dbRun(`
        UPDATE craids
        SET title = ?, description = ?, status = ?, priority = ?, owner_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [title, description, status, priority, owner_id, req.params.id]);
  
      await logAudit(req.user, 'UPDATE', 'craids', req.params.id,
        { title: craid.title, description: craid.description, status: craid.status, priority: craid.priority, owner_id: craid.owner_id },
        { title, description, status, priority, owner_id },
        `Updated ${craid.type} "${craid.title}"`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.delete('/api/craids/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this CRAID
      const craid = await dbGet('SELECT * FROM craids WHERE id = ?', [req.params.id]);
      if (!craid) {
        return res.status(404).json({ error: 'Item not found' });
      }
  
      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, craid.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this item' });
      }
  
      await dbRun('DELETE FROM craids WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'craids', req.params.id,
        { type: craid.type, title: craid.title, description: craid.description, status: craid.status },
        null,
        `Deleted ${craid.type} "${craid.title}" from project ID ${craid.project_id}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== USER MANAGEMENT =====
  // Get all users (Admin, PM, and Editor can view for project manager selection)
  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      if (!user.role) {
        return res.status(500).json({ error: 'User role not set. Please restart the server to run migrations.' });
      }
  
      // Allow admins, PMs, and editors to view users (needed for project manager selection)
      if (user.role !== ROLES.ADMIN && user.role !== ROLES.PM && user.role !== ROLES.EDITOR) {
        return res.status(403).json({ error: 'You do not have permission to view users' });
      }
  
      const users = await dbAll('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC');
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update user role (Admin only)
  app.put('/api/users/:id/role', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can update user roles' });
      }
  
      const { role } = req.body;
      if (!['admin', 'pm', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
  
      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  
      await logAudit(req.user, 'UPDATE', 'users', req.params.id,
        { role: targetUser.role },
        { role },
        `Updated user ${targetUser.email} role from ${targetUser.role} to ${role}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Delete user (Admin only)
  app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can delete users' });
      }
  
      // Prevent deleting yourself
      if (parseInt(req.params.id) === req.user.userId) {
        return res.status(400).json({ error: 'You cannot delete yourself' });
      }
  
      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Clear user_id from audit_log to prevent foreign key constraint error
      // We keep the audit log entries but anonymize them
      await dbRun('UPDATE audit_log SET user_id = NULL WHERE user_id = ?', [req.params.id]);

      await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
  
      await logAudit(req.user, 'DELETE', 'users', req.params.id,
        { email: targetUser.email, name: targetUser.name, role: targetUser.role },
        null,
        `Deleted user ${targetUser.email}`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== PROJECT PERMISSIONS =====
  // Get project permissions (Admin or project PM)
  app.get('/api/projects/:projectId/permissions', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  
      // Check if user can view permissions (admin or has edit access to the project)
      if (!isAdmin(user) && !(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to view project permissions' });
      }
  
      const permissions = await dbAll(`
        SELECT pp.id, pp.user_id, pp.created_at, u.email, u.name, u.role
        FROM project_permissions pp
        JOIN users u ON pp.user_id = u.id
        WHERE pp.project_id = ?
        ORDER BY u.name
      `, [req.params.projectId]);
  
      res.json(permissions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Grant project permission (Admin only)
  app.post('/api/projects/:projectId/permissions', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can grant project permissions' });
      }

      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }
  
      // Check if target user exists and is a PM or Editor
      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [user_id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.role !== 'pm' && targetUser.role !== 'editor') {
        return res.status(400).json({ error: 'Can only grant permissions to PM or Editor users' });
      }
  
      // Check if permission already exists
      const existing = await dbGet(
        'SELECT id FROM project_permissions WHERE project_id = ? AND user_id = ?',
        [req.params.projectId, user_id]
      );
      if (existing) {
        return res.status(400).json({ error: 'Permission already exists' });
      }
  
      await dbRun(
        'INSERT INTO project_permissions (project_id, user_id) VALUES (?, ?)',
        [req.params.projectId, user_id]
      );
  
      const project = await dbGet('SELECT name FROM projects WHERE id = ?', [req.params.projectId]);
  
      await logAudit(req.user, 'CREATE', 'project_permissions', null,
        null,
        { project_id: req.params.projectId, user_id },
        `Granted ${targetUser.email} permission to project "${project.name}"`,
        req.ip
      );

      res.status(201).json({
        success: true,
        message: `Permission granted to ${targetUser.email} for project "${project.name}"`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Revoke project permission (Admin only)
  app.delete('/api/projects/:projectId/permissions/:userId', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can revoke project permissions' });
      }

      // Check if permission exists
      const permission = await dbGet(
        'SELECT id FROM project_permissions WHERE project_id = ? AND user_id = ?',
        [req.params.projectId, req.params.userId]
      );
      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.userId]);
      const project = await dbGet('SELECT name FROM projects WHERE id = ?', [req.params.projectId]);

      await dbRun(
        'DELETE FROM project_permissions WHERE project_id = ? AND user_id = ?',
        [req.params.projectId, req.params.userId]
      );
  
      await logAudit(req.user, 'DELETE', 'project_permissions', null,
        { project_id: req.params.projectId, user_id: req.params.userId },
        null,
        `Revoked ${targetUser?.email || 'user'} permission from project "${project?.name || 'unknown'}"`,
        req.ip
      );
  
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== AUDIT LOG =====
  app.get('/api/audit', authenticateToken, async (req, res) => {
    try {
      // Admin only
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { limit = 100, offset = 0, table_name, user_id, action, project_id } = req.query;

      let query = '';
      const params = [];

      // Special handling for project_id filter with metric_periods table
      if (project_id && table_name === 'metric_periods') {
        // Get all metric IDs for this project first
        const metrics = await dbAll('SELECT id FROM metrics WHERE project_id = ?', [parseInt(project_id)]);
        const metricIds = metrics.map(m => m.id);

        if (metricIds.length === 0) {
          return res.json([]);
        }

        // Get all metric_period IDs for these metrics
        const periods = await dbAll(
          `SELECT id FROM metric_periods WHERE metric_id IN (${metricIds.map(() => '?').join(',')})`,
          metricIds
        );
        const periodIds = periods.map(p => p.id);

        if (periodIds.length === 0) {
          return res.json([]);
        }

        // Filter audit log by these period IDs
        query = `SELECT *, created_at as timestamp FROM audit_log
                 WHERE table_name = 'metric_periods'
                 AND record_id IN (${periodIds.map(() => '?').join(',')})`;
        params.push(...periodIds);

        if (user_id) {
          query += ' AND user_id = ?';
          params.push(parseInt(user_id));
        }
        if (action) {
          query += ' AND action = ?';
          params.push(action);
        }
      } else {
        query = 'SELECT *, created_at as timestamp FROM audit_log WHERE 1=1';

        if (table_name) {
          query += ' AND table_name = ?';
          params.push(table_name);
        }
        if (user_id) {
          query += ' AND user_id = ?';
          params.push(parseInt(user_id));
        }
        if (action) {
          query += ' AND action = ?';
          params.push(action);
        }
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const logs = await dbAll(query, params);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== AUTO-GENERATE FEEDBACK FROM CONSISTENCY ISSUES =====
  // Helper function to create or get system user
  async function getSystemUserId() {
    let systemUser = await dbGet('SELECT id FROM users WHERE email = ?', ['system@progress-tracker']);
    if (!systemUser) {
      // Create system user
      const hash = await hashPassword(Math.random().toString(36));
      const result = await dbRun(
        'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
        ['system@progress-tracker', 'System', hash, 'viewer']
      );
      systemUser = { id: result.lastID };
      console.log('✅ Created system user for automated feedback');
    }
    return systemUser.id;
  }

  // Helper function to generate a unique key for each issue type to prevent duplicates
  function getIssueKey(issue) {
    switch (issue.type) {
      case 'vacation_month_growth':
        return `vacation_month_growth:${issue.project_id}:${issue.metric_id}`;
      case 'all_back_loaded':
        return `all_back_loaded:${issue.project_id}`;
      case 'single_metric':
        return `single_metric:${issue.project_id}`;
      case 'no_lead_metrics':
        return `no_lead_metrics:${issue.project_id}`;
      case 'metric_type_mismatch':
        return `metric_type_mismatch:${issue.project_id}:${issue.metric_id}`;
      default:
        return `unknown:${issue.project_id}`;
    }
  }

  // Generate consistency feedback automatically
  async function generateConsistencyFeedback() {
    try {
      const systemUserId = await getSystemUserId();

      // Reuse consistency report logic to get issues
      const issues = [];

      // 1. Vacation month growth
      const vacationMonthGrowth = await dbAll(`
        WITH growth_calc AS (
          SELECT
            p.id as project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            m.id as metric_id,
            m.name as metric_name,
            mp.reporting_date,
            mp.complete,
            LAG(mp.complete) OVER (PARTITION BY m.id ORDER BY mp.reporting_date) as prev_complete
          FROM metric_periods mp
          JOIN metrics m ON mp.metric_id = m.id
          JOIN projects p ON m.project_id = p.id
          WHERE CAST(strftime('%m', mp.reporting_date) AS INTEGER) IN (1, 8)
        )
        SELECT
          project_id,
          project_name,
          pm_name,
          metric_id,
          metric_name,
          reporting_date,
          complete,
          prev_complete,
          complete - prev_complete as growth
        FROM growth_calc
        WHERE complete > COALESCE(prev_complete, 0)
        AND (complete - prev_complete) IS NOT NULL
        ORDER BY project_name, metric_name, reporting_date
      `);

      const metricsWithVacationGrowth = new Map();
      for (const row of vacationMonthGrowth) {
        if (!row.prev_complete || row.growth === null) continue;

        const key = `${row.project_id}-${row.metric_id}`;
        if (!metricsWithVacationGrowth.has(key)) {
          metricsWithVacationGrowth.set(key, {
            project_id: row.project_id,
            project_name: row.project_name,
            pm_name: row.pm_name,
            metric_id: row.metric_id,
            metric_name: row.metric_name,
            vacation_periods: []
          });
        }

        const avgGrowth = await dbGet(`
          WITH lag_calc AS (
            SELECT
              mp.complete,
              LAG(mp.complete) OVER (PARTITION BY mp.metric_id ORDER BY mp.reporting_date) as prev_complete
            FROM metric_periods mp
            WHERE mp.metric_id = ?
          ),
          growth_all AS (
            SELECT
              complete - prev_complete as growth
            FROM lag_calc
          )
          SELECT AVG(growth) as avg_growth
          FROM growth_all
          WHERE growth IS NOT NULL AND growth > 0
        `, [row.metric_id]);

        if (avgGrowth && avgGrowth.avg_growth && row.growth > avgGrowth.avg_growth * 0.8) {
          metricsWithVacationGrowth.get(key).vacation_periods.push({
            date: row.reporting_date,
            growth: row.growth,
            avg_growth: avgGrowth.avg_growth
          });
        }
      }

      for (const [, value] of metricsWithVacationGrowth) {
        if (value.vacation_periods.length > 0) {
          const months = value.vacation_periods.map(p => {
            const month = new Date(p.date).getMonth() + 1;
            return month === 1 ? 'January (December work)' : 'August (July/August work)';
          });
          issues.push({
            type: 'vacation_month_growth',
            severity: 'warning',
            project_id: value.project_id,
            project_name: value.project_name,
            pm_name: value.pm_name,
            metric_id: value.metric_id,
            metric_name: value.metric_name,
            details: `Normal or accelerated growth detected during vacation months: ${months.join(', ')}. Reporting dates: ${value.vacation_periods.map(p => p.date).join(', ')}`
          });
        }
      }

      // 2. Back-loaded growth
      const backLoadedMetrics = await dbAll(`
        WITH lag_calc AS (
          SELECT
            m.id as metric_id,
            m.name as metric_name,
            m.project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            mp.reporting_date,
            mp.complete,
            LAG(mp.complete, 1, 0) OVER (PARTITION BY m.id ORDER BY mp.reporting_date) as prev_complete
          FROM metric_periods mp
          JOIN metrics m ON mp.metric_id = m.id
          JOIN projects p ON m.project_id = p.id
        ),
        period_growth AS (
          SELECT
            metric_id,
            metric_name,
            project_id,
            project_name,
            pm_name,
            reporting_date,
            ROW_NUMBER() OVER (PARTITION BY metric_id ORDER BY reporting_date) as period_num,
            COUNT(*) OVER (PARTITION BY metric_id) as total_periods,
            complete - prev_complete as growth
          FROM lag_calc
        ),
        first_half_growth AS (
          SELECT
            metric_id,
            metric_name,
            project_id,
            project_name,
            pm_name,
            SUM(growth) as first_half_total,
            AVG(growth) as first_half_avg
          FROM period_growth
          WHERE period_num <= total_periods / 2
          GROUP BY metric_id, metric_name, project_id, project_name, pm_name
        ),
        second_half_growth AS (
          SELECT
            metric_id,
            SUM(growth) as second_half_total,
            AVG(growth) as second_half_avg
          FROM period_growth
          WHERE period_num > total_periods / 2
          GROUP BY metric_id
        )
        SELECT
          f.project_id,
          f.project_name,
          f.pm_name,
          f.metric_id,
          f.metric_name,
          f.first_half_total,
          f.first_half_avg,
          s.second_half_total,
          s.second_half_avg
        FROM first_half_growth f
        JOIN second_half_growth s ON f.metric_id = s.metric_id
        WHERE s.second_half_total > f.first_half_total * 2
      `);

      const projectMetrics = new Map();
      for (const metric of backLoadedMetrics) {
        if (!projectMetrics.has(metric.project_id)) {
          projectMetrics.set(metric.project_id, {
            project_name: metric.project_name,
            pm_name: metric.pm_name,
            back_loaded: [],
            total: 0
          });
        }
        projectMetrics.get(metric.project_id).back_loaded.push(metric);
      }

      for (const [projectId, data] of projectMetrics) {
        const totalMetrics = await dbGet(
          'SELECT COUNT(*) as count FROM metrics WHERE project_id = ?',
          [projectId]
        );
        data.total = totalMetrics.count;

        if (data.back_loaded.length === data.total && data.total > 0) {
          issues.push({
            type: 'all_back_loaded',
            severity: 'high',
            project_id: projectId,
            project_name: data.project_name,
            pm_name: data.pm_name,
            details: `All ${data.total} metric(s) show back-loaded growth (majority of progress in second half)`
          });
        }
      }

      // 3. Single metric projects
      const singleMetricProjects = await dbAll(`
        WITH project_metric_counts AS (
          SELECT
            p.id as project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            m.id as metric_id,
            m.name as metric_name,
            COUNT(m.id) OVER (PARTITION BY p.id) as metric_count
          FROM projects p
          LEFT JOIN metrics m ON p.id = m.project_id
        )
        SELECT *
        FROM project_metric_counts
        WHERE metric_count = 1
      `);

      for (const project of singleMetricProjects) {
        issues.push({
          type: 'single_metric',
          severity: 'info',
          project_id: project.project_id,
          project_name: project.project_name,
          pm_name: project.pm_name,
          metric_id: project.metric_id,
          metric_name: project.metric_name,
          details: 'Project has only one metric'
        });
      }

      // 4. No lead metrics
      const projectsWithoutLeadMetrics = await dbAll(`
        WITH project_metrics AS (
          SELECT
            p.id as project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            COUNT(m.id) as total_metrics,
            SUM(CASE WHEN m.metric_type = 'lead' OR m.metric_type IS NULL THEN 1 ELSE 0 END) as lead_count,
            SUM(CASE WHEN m.metric_type = 'lag' THEN 1 ELSE 0 END) as lag_count
          FROM projects p
          LEFT JOIN metrics m ON p.id = m.project_id
          GROUP BY p.id, p.name, p.initiative_manager
        )
        SELECT
          project_id,
          project_name,
          pm_name,
          total_metrics,
          lead_count,
          lag_count
        FROM project_metrics
        WHERE total_metrics > 0 AND lead_count = 0
      `);

      for (const project of projectsWithoutLeadMetrics) {
        issues.push({
          type: 'no_lead_metrics',
          severity: 'warning',
          project_id: project.project_id,
          project_name: project.project_name,
          pm_name: project.pm_name,
          details: `Project has ${project.lag_count} lag metric(s) but no lead metrics. Lead metrics provide early indicators of progress.`
        });
      }

      // 5. Metric type mismatches
      const metricTypeMismatches = await dbAll(`
        WITH growth_calc AS (
          SELECT
            m.id as metric_id,
            m.name as metric_name,
            m.metric_type,
            m.project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            mp.reporting_date,
            mp.complete,
            LAG(mp.complete, 1, 0) OVER (PARTITION BY m.id ORDER BY mp.reporting_date) as prev_complete
          FROM metric_periods mp
          JOIN metrics m ON mp.metric_id = m.id
          JOIN projects p ON m.project_id = p.id
          WHERE mp.complete IS NOT NULL
        ),
        period_analysis AS (
          SELECT
            metric_id,
            metric_name,
            metric_type,
            project_id,
            project_name,
            pm_name,
            ROW_NUMBER() OVER (PARTITION BY metric_id ORDER BY reporting_date) as period_num,
            COUNT(*) OVER (PARTITION BY metric_id) as total_periods,
            complete - prev_complete as growth,
            SUM(complete - prev_complete) OVER (PARTITION BY metric_id) as total_growth
          FROM growth_calc
        ),
        final_30_percent AS (
          SELECT
            metric_id,
            metric_name,
            metric_type,
            project_id,
            project_name,
            pm_name,
            total_periods,
            SUM(growth) as final_30_growth,
            MAX(total_growth) as total_growth
          FROM period_analysis
          WHERE period_num > (total_periods * 0.7)
          GROUP BY metric_id, metric_name, metric_type, project_id, project_name, pm_name, total_periods
        )
        SELECT
          metric_id,
          metric_name,
          metric_type,
          project_id,
          project_name,
          pm_name,
          total_periods,
          final_30_growth,
          total_growth,
          CAST(final_30_growth AS REAL) / NULLIF(total_growth, 0) as final_30_percent
        FROM final_30_percent
        WHERE total_growth > 0
          AND (
            (metric_type = 'lag' AND (final_30_growth / NULLIF(total_growth, 0)) < 0.5)
            OR
            (metric_type = 'lead' AND (final_30_growth / NULLIF(total_growth, 0)) > 0.7)
          )
      `);

      for (const metric of metricTypeMismatches) {
        const percentInFinal = (metric.final_30_percent * 100).toFixed(1);
        if (metric.metric_type === 'lag') {
          issues.push({
            type: 'metric_type_mismatch',
            severity: 'warning',
            project_id: metric.project_id,
            project_name: metric.project_name,
            pm_name: metric.pm_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `Metric '${metric.metric_name}' is declared as 'lag' but shows progressive pattern with only ${percentInFinal}% of progress in final 30% of periods. Consider changing to 'lead' type.`
          });
        } else {
          issues.push({
            type: 'metric_type_mismatch',
            severity: 'warning',
            project_id: metric.project_id,
            project_name: metric.project_name,
            pm_name: metric.pm_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `Metric '${metric.metric_name}' is declared as 'lead' but shows back-loaded pattern with ${percentInFinal}% of progress in final 30% of periods. Consider changing to 'lag' type.`
          });
        }
      }

      // Now create feedback entries for each issue (avoiding duplicates)
      let createdCount = 0;
      let skippedCount = 0;

      for (const issue of issues) {
        const issueKey = getIssueKey(issue);
        const feedbackText = `[${issue.severity.toUpperCase()}] ${issue.project_name}: ${issue.details}`;

        // Check if this feedback already exists (based on similar text and project)
        const existing = await dbGet(
          `SELECT id FROM feedback
           WHERE project_id = ?
           AND text LIKE ?
           AND status IN ('open', 'responded')
           LIMIT 1`,
          [issue.project_id, `%${issue.details.substring(0, 50)}%`]
        );

        if (!existing) {
          // Create new feedback
          await dbRun(
            `INSERT INTO feedback (user_id, text, status, project_id)
             VALUES (?, ?, 'open', ?)`,
            [systemUserId, feedbackText, issue.project_id]
          );
          createdCount++;
        } else {
          skippedCount++;
        }
      }

      console.log(`✅ Consistency feedback generated: ${createdCount} created, ${skippedCount} skipped (duplicates)`);
      return { created: createdCount, skipped: skippedCount, total: issues.length };
    } catch (err) {
      console.error('Error generating consistency feedback:', err);
      throw err;
    }
  }

  // Endpoint to manually trigger consistency feedback generation (admin only)
  app.post('/api/admin/generate-consistency-feedback', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await generateConsistencyFeedback();
      res.json({
        success: true,
        message: `Generated consistency feedback: ${result.created} created, ${result.skipped} skipped`,
        ...result
      });
    } catch (err) {
      console.error('Error generating consistency feedback:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint to get inconsistency report (all users can see, shows issues by PM)
  app.get('/api/inconsistency-report', async (req, res) => {
    try {
      const inconsistencies = [];

      // TODO: Implement RAG status calculation for metrics without recovery plans
      // For now, just check other types of inconsistencies

      // 1. Projects without descriptions
      const projectsWithoutDesc = await dbAll(`
        SELECT
          p.id as project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.created_at as first_detected
        FROM projects p
        WHERE p.description IS NULL OR p.description = ''
        ORDER BY p.initiative_manager, p.name
      `);

      for (const project of projectsWithoutDesc) {
        inconsistencies.push({
          type: 'missing_project_description',
          severity: 'low',
          pm_name: project.pm_name,
          project_id: project.project_id,
          project_name: project.project_name,
          metric_id: null,
          metric_name: null,
          details: 'Project missing description',
          first_detected: project.first_detected,
          age_days: Math.floor((Date.now() - new Date(project.first_detected)) / (1000 * 60 * 60 * 24))
        });
      }

      // 2. Metrics without descriptions
      const metricsWithoutDescriptions = await dbAll(`
        SELECT
          m.id as metric_id,
          m.name as metric_name,
          m.project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          m.created_at as first_detected
        FROM metrics m
        JOIN projects p ON m.project_id = p.id
        WHERE m.description IS NULL OR TRIM(m.description) = ''
        ORDER BY p.initiative_manager, p.name, m.name
      `);

      for (const metric of metricsWithoutDescriptions) {
        inconsistencies.push({
          type: 'missing_metric_description',
          severity: 'low',
          pm_name: metric.pm_name,
          project_id: metric.project_id,
          project_name: metric.project_name,
          metric_id: metric.metric_id,
          metric_name: metric.metric_name,
          details: 'Metric missing description',
          first_detected: metric.first_detected,
          age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
        });
      }

      // 3. Projects without documentation links
      const projectsWithoutDocs = await dbAll(`
        SELECT
          p.id as project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.created_at as first_detected
        FROM projects p
        LEFT JOIN project_links pl ON p.id = pl.project_id
        WHERE pl.id IS NULL
        ORDER BY p.initiative_manager, p.name
      `);

      for (const proj of projectsWithoutDocs) {
        inconsistencies.push({
          type: 'missing_documentation',
          severity: 'low',
          pm_name: proj.pm_name,
          project_id: proj.project_id,
          project_name: proj.project_name,
          details: 'Project has no documentation links',
          first_detected: proj.first_detected,
          age_days: Math.floor((Date.now() - new Date(proj.first_detected)) / (1000 * 60 * 60 * 24))
        });
      }

      // 4. Metrics that are red or amber but have no recovery plan
      // RAG status is calculated dynamically since it's not stored in the database
      const allMetrics = await dbAll(`
        SELECT
          m.id as metric_id,
          m.name as metric_name,
          m.project_id,
          m.amber_tolerance,
          m.red_tolerance,
          p.name as project_name,
          p.initiative_manager as pm_name,
          m.created_at as first_detected
        FROM metrics m
        JOIN projects p ON m.project_id = p.id
        LEFT JOIN recovery_plans rp ON m.id = rp.metric_id AND rp.status = 'active'
        WHERE rp.id IS NULL
        ORDER BY p.initiative_manager, p.name, m.name
      `);

      for (const metric of allMetrics) {
        // Get all periods for this metric, sorted by date
        const periods = await dbAll(`
          SELECT id, reporting_date, complete, expected
          FROM metric_periods
          WHERE metric_id = ?
          ORDER BY reporting_date ASC
        `, [metric.metric_id]);

        if (periods.length === 0) continue;

        // Find the current period (matches logic in backend/src/server.js:570-598)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentPeriodIndex = -1;
        for (let i = 0; i < periods.length; i++) {
          const periodStart = new Date(periods[i].reporting_date);
          periodStart.setHours(0, 0, 0, 0);

          if (periodStart <= today) {
            if (i + 1 < periods.length) {
              const nextPeriodStart = new Date(periods[i + 1].reporting_date);
              nextPeriodStart.setHours(0, 0, 0, 0);
              if (today < nextPeriodStart) {
                currentPeriodIndex = i;
                break;
              }
            } else {
              currentPeriodIndex = i;
            }
          }
        }

        if (currentPeriodIndex === -1) continue;

        const currentPeriod = periods[currentPeriodIndex];
        const isInCurrentPeriod = currentPeriodIndex === periods.length - 1 ||
          today < new Date(periods[currentPeriodIndex + 1].reporting_date);

        // Helper function to calculate RAG for a specific period
        const calculateRAGForPeriod = (period) => {
          if (period.complete === null || period.expected === null) {
            return 'grey';
          }

          const variance = period.complete - period.expected;
          const variancePercent = period.expected > 0
            ? Math.abs((variance / period.expected) * 100)
            : 0;

          const amberTolerance = parseFloat(metric.amber_tolerance) || 5.0;
          const redTolerance = parseFloat(metric.red_tolerance) || 10.0;

          if (period.expected === 0) return 'grey';
          if (variance >= 0) return 'green';
          if (variancePercent > redTolerance) return 'red';
          if (variancePercent > amberTolerance) return 'amber';
          return 'green';
        };

        // Determine RAG status (matches logic in backend/src/server.js:635-659)
        let ragStatus;
        if (isInCurrentPeriod) {
          const currentComplete = currentPeriod.complete || 0;
          if (currentComplete === 0 && currentPeriodIndex > 0) {
            ragStatus = calculateRAGForPeriod(periods[currentPeriodIndex - 1]);
          } else {
            ragStatus = calculateRAGForPeriod(currentPeriod);
          }
        } else {
          ragStatus = calculateRAGForPeriod(currentPeriod);
        }

        // Add to inconsistencies if red or amber
        if (ragStatus === 'red' || ragStatus === 'amber') {
          inconsistencies.push({
            type: 'missing_recovery_plan',
            severity: 'high',
            pm_name: metric.pm_name,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `${metric.metric_name} is ${ragStatus.toUpperCase()} but has no recovery plan`,
            rag_status: ragStatus,
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Group by PM and count
      const byPM = inconsistencies.reduce((acc, item) => {
        if (!acc[item.pm_name]) {
          acc[item.pm_name] = {
            pm_name: item.pm_name,
            total: 0,
            high: 0,
            medium: 0,
            low: 0,
            issues: []
          };
        }
        acc[item.pm_name].total++;
        acc[item.pm_name][item.severity]++;
        acc[item.pm_name].issues.push(item);
        return acc;
      }, {});

      // Convert to array and sort by total descending
      const summary = Object.values(byPM).sort((a, b) => b.total - a.total);

      res.json({
        summary,
        total_inconsistencies: inconsistencies.length,
        by_severity: {
          high: inconsistencies.filter(i => i.severity === 'high').length,
          medium: inconsistencies.filter(i => i.severity === 'medium').length,
          low: inconsistencies.filter(i => i.severity === 'low').length
        }
      });
    } catch (err) {
      console.error('Error generating inconsistency report:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Auto-generate consistency feedback on server start (after a delay to ensure DB is ready)
  // Skip in test mode to avoid interfering with tests
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(async () => {
      try {
        await generateConsistencyFeedback();
      } catch (err) {
        console.error('Error in initial consistency feedback generation:', err);
      }
    }, 5000); // 5 second delay after server start
  }

  // ===== PAGE ANALYTICS =====
  // Track page view (optional authentication - captures user if logged in)
  app.post('/api/analytics/pageview', optionalAuthenticateToken, async (req, res) => {
    try {
      const { path, session_id } = req.body;
      const userId = req.user?.userId || null;

      if (!path) {
        return res.status(204).send(); // Silent fail if no path
      }

      // Store page view asynchronously (fire and forget)
      dbRun(
        'INSERT INTO page_views (user_id, path, session_id) VALUES (?, ?, ?)',
        [userId, path, session_id]
      ).catch(err => {
        console.error('Page view tracking error:', err);
      });

      res.status(204).send();
    } catch (err) {
      console.error('Page view endpoint error:', err);
      res.status(204).send(); // Always return 204 to not break client
    }
  });

  // Get page heatmap data (admin only) - filtered for projects only
  app.get('/api/admin/page-heatmap', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { days = 30 } = req.query;
      const daysAgo = new Date();
      const parsedDays = parseInt(days) || 30; // Default to 30 if invalid
      daysAgo.setDate(daysAgo.getDate() - parsedDays);

      // Get page view counts (only Project pages)
      const pageViewCounts = await dbAll(`
        SELECT path, COUNT(*) as view_count
        FROM page_views
        WHERE created_at >= ? AND path LIKE 'Project:%'
        GROUP BY path
        ORDER BY view_count DESC
      `, [daysAgo.toISOString()]);

      // Get timeline data (views by date)
      const timeline = await dbAll(`
        SELECT DATE(created_at) as date, COUNT(*) as views
        FROM page_views
        WHERE created_at >= ? AND path LIKE 'Project:%'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [daysAgo.toISOString()]);

      // Get top users by view count
      const topUsers = await dbAll(`
        SELECT
          COALESCE(u.name, 'Anonymous') as user_name,
          u.email as user_email,
          COUNT(*) as view_count
        FROM page_views pv
        LEFT JOIN users u ON pv.user_id = u.id
        WHERE pv.created_at >= ? AND pv.path LIKE 'Project:%'
        GROUP BY pv.user_id, u.name, u.email
        ORDER BY view_count DESC
        LIMIT 10
      `, [daysAgo.toISOString()]);

      res.json({
        pageViewCounts,
        timeline,
        topUsers,
        period: parsedDays
      });
    } catch (err) {
      console.error('Page heatmap error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== USER ACTIVITY REPORT =====
  app.get('/api/admin/user-activity', authenticateToken, async (req, res) => {
    try {
      // Check if user is admin
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { days = 30 } = req.query;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));

      // Get activity counts by user and activity type
      const activityByUser = await dbAll(`
        SELECT
          COALESCE(u.name, a.user_email, 'Unknown') as user_name,
          COALESCE(u.email, a.user_email) as user_email,
          a.action,
          a.table_name,
          COUNT(*) as count
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.created_at >= ?
        GROUP BY COALESCE(u.name, a.user_email, 'Unknown'), a.action, a.table_name
        ORDER BY user_name, count DESC
      `, [daysAgo.toISOString()]);

      // Get total activity by user (for ranking)
      const totalsByUser = await dbAll(`
        SELECT
          COALESCE(u.name, a.user_email, 'Unknown') as user_name,
          COALESCE(u.email, a.user_email) as user_email,
          COUNT(*) as total_activity
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.created_at >= ?
        GROUP BY COALESCE(u.name, a.user_email, 'Unknown')
        ORDER BY total_activity DESC
      `, [daysAgo.toISOString()]);

      // Get activity timeline (daily counts)
      const activityTimeline = await dbAll(`
        SELECT
          DATE(a.created_at) as date,
          COALESCE(u.name, a.user_email, 'Unknown') as user_name,
          COUNT(*) as count
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.created_at >= ?
        GROUP BY DATE(a.created_at), COALESCE(u.name, a.user_email, 'Unknown')
        ORDER BY date DESC
      `, [daysAgo.toISOString()]);

      // Transform data for stacked bar chart
      const userActivityMap = {};
      activityByUser.forEach(row => {
        if (!userActivityMap[row.user_name]) {
          userActivityMap[row.user_name] = {
            user_name: row.user_name,
            user_email: row.user_email,
            activities: {}
          };
        }
        const activityType = `${row.action}_${row.table_name}`;
        userActivityMap[row.user_name].activities[activityType] =
          (userActivityMap[row.user_name].activities[activityType] || 0) + row.count;
      });

      // Get all unique activity types for the legend
      const activityTypes = [...new Set(activityByUser.map(row => `${row.action}_${row.table_name}`))].sort();

      res.json({
        users: totalsByUser,
        activityBreakdown: Object.values(userActivityMap),
        activityTypes,
        timeline: activityTimeline,
        period: parseInt(days)
      });
    } catch (err) {
      console.error('User activity report error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== TIME TRAVEL (Reconstruct historical state from audit log) =====
  app.get('/api/projects/:projectId/data/time-travel', authenticateToken, async (req, res) => {
    try {
      const { timestamp } = req.query;
  
      if (!timestamp) {
        return res.status(400).json({ error: 'timestamp parameter is required' });
      }
  
      const targetDate = new Date(timestamp);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid timestamp format' });
      }
  
      const projectId = req.params.projectId;
  
      // Get all metric_periods for this project at the target time
      // We need to replay the audit log to reconstruct the state
  
      // First, get all metrics for this project
      const metrics = await dbAll('SELECT id FROM metrics WHERE project_id = ?', [projectId]);
      const metricIds = metrics.map(m => m.id);
  
      if (metricIds.length === 0) {
        return res.json([]);
      }
  
      // Get all metric_periods for these metrics (current state)
      const periods = await dbAll(`
        SELECT
          mp.id,
          mp.metric_id,
          mp.reporting_date,
          mp.expected,
          mp.target,
          mp.complete
        FROM metric_periods mp
        WHERE mp.metric_id IN (${metricIds.map(() => '?').join(',')})
        ORDER BY mp.id
      `, metricIds);
  
      // Get ALL audit log entries for metric_periods (we need CREATE entries for all periods)
      const allAuditLogs = await dbAll(`
        SELECT
          id,
          action,
          record_id,
          old_values,
          new_values,
          created_at
        FROM audit_log
        WHERE table_name = 'metric_periods'
        ORDER BY created_at ASC, id ASC
      `);
  
      // Create a map of period states - initialize from CREATE audit entries
      const periodStates = {};
  
      // First pass: Find CREATE entries to establish initial state
      allAuditLogs.forEach(log => {
        if (log.action === 'CREATE') {
          const recordId = log.record_id;
          const newValues = JSON.parse(log.new_values || '{}');
          const createdAt = new Date(log.created_at);
  
          if (metricIds.includes(newValues.metric_id)) {
            periodStates[recordId] = {
              id: recordId,
              metric_id: newValues.metric_id,
              reporting_date: newValues.reporting_date,
              expected: newValues.expected || 0,
              target: newValues.target || 0,
              // Only use complete from CREATE if period was created before time travel date
              complete: createdAt <= targetDate ? (newValues.complete || 0) : 0,
              commentary: createdAt <= targetDate ? (newValues.commentary || null) : null
            };
          }
        }
      });
  
      // Add any current periods that don't have CREATE audit entries (shouldn't happen but handle it)
      periods.forEach(period => {
        if (!periodStates[period.id]) {
          periodStates[period.id] = {
            id: period.id,
            metric_id: period.metric_id,
            reporting_date: period.reporting_date,
            expected: period.expected,
            target: period.target,
            complete: 0,
            commentary: null
          };
        }
      });
  
      // Second pass: Apply UPDATE/DELETE entries up to target timestamp
      const auditLogs = allAuditLogs.filter(log =>
        new Date(log.created_at) <= targetDate
      );
  
      // Replay audit log to reconstruct historical state
      auditLogs.forEach(log => {
        const recordId = log.record_id;
  
        if (log.action === 'CREATE') {
          // CREATE already handled in first pass, skip
          return;
        } else if (log.action === 'UPDATE') {
          // Update the period state if it exists
          if (periodStates[recordId]) {
            const newValues = JSON.parse(log.new_values || '{}');
            const periodReportingDate = new Date(periodStates[recordId].reporting_date);
  
            // Apply updates for complete, expected (plan changes), target (scope changes), and commentary
            // For complete: only apply if the period's reporting date has occurred
            if (newValues.complete !== undefined && periodReportingDate <= targetDate) {
              periodStates[recordId].complete = newValues.complete;
            }
            // For expected and target: always apply (plan/scope changes can happen before period date)
            if (newValues.expected !== undefined) {
              periodStates[recordId].expected = newValues.expected;
            }
            if (newValues.target !== undefined) {
              periodStates[recordId].target = newValues.target;
            }
            // For commentary: always apply (commentary is added as events occur)
            if (newValues.commentary !== undefined) {
              periodStates[recordId].commentary = newValues.commentary;
            }
          }
        } else if (log.action === 'DELETE') {
          // Remove period from state if deleted
          if (periodStates[recordId]) {
            delete periodStates[recordId];
          }
        }
      });
  
      // Format the response - include all periods (existing and future)
      const historicalData = await Promise.all(
        Object.values(periodStates)
          .filter(period => metricIds.includes(period.metric_id))
          .map(async (period) => {
            // Get metric and project info
            const metric = await dbGet(`
              SELECT m.name, m.description, m.project_id, m.final_target, m.amber_tolerance, m.red_tolerance, m.start_date, m.end_date, m.frequency, m.progression_type, m.metric_type, p.name as initiative, p.initiative_manager
              FROM metrics m
              JOIN projects p ON m.project_id = p.id
              WHERE m.id = ?
            `, [period.metric_id]);

            const owner = await dbGet('SELECT name FROM users WHERE id = (SELECT owner_id FROM metrics WHERE id = ?)', [period.metric_id]);

            return {
              id: period.id,
              reporting_date: period.reporting_date,
              metric: metric?.name || 'Unknown',
              metric_description: metric?.description || null,
              expected: period.expected,
              final_target: period.target, // Period target (cumulative expected for this period)
              metric_final_target: metric?.final_target || period.target, // Metric's overall final target
              complete: period.complete,
              commentary: period.commentary,
              metric_id: period.metric_id,
              amber_tolerance: metric?.amber_tolerance || 5.0,
              red_tolerance: metric?.red_tolerance || 10.0,
              start_date: metric?.start_date || null,
              end_date: metric?.end_date || null,
              frequency: metric?.frequency || null,
              progression_type: metric?.progression_type || 'linear',
              metric_type: metric?.metric_type || 'lead',
              initiative: metric?.initiative || 'Unknown',
              owner: owner?.name || null,
              initiative_manager: metric?.initiative_manager || null
            };
          })
      );
  
      res.json(historicalData.sort((a, b) => new Date(a.reporting_date) - new Date(b.reporting_date)));
    } catch (err) {
      console.error('Time travel error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== REVERT TO HISTORICAL STATE =====
  app.post('/api/projects/:projectId/data/revert', authenticateToken, async (req, res) => {
    try {
      const { timestamp } = req.body;
      const projectId = req.params.projectId;
      const userId = req.user.userId;
  
      // Check permissions - only admin can revert
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can revert to historical states' });
      }
  
      if (!timestamp) {
        return res.status(400).json({ error: 'timestamp is required' });
      }
  
      const targetDate = new Date(timestamp);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid timestamp format' });
      }
  
      // Get the historical state using the same logic as time-travel endpoint
      // First, get all metrics for this project
      const metrics = await dbAll('SELECT id FROM metrics WHERE project_id = ?', [projectId]);
      const metricIds = metrics.map(m => m.id);
  
      if (metricIds.length === 0) {
        return res.status(400).json({ error: 'No metrics found for this project' });
      }
  
      // Get all current periods
      const currentPeriods = await dbAll(`
        SELECT id, metric_id, reporting_date, expected, target, complete, commentary
        FROM metric_periods
        WHERE metric_id IN (${metricIds.map(() => '?').join(',')})
      `, metricIds);
  
      // Get ALL audit log entries for metric_periods
      const allAuditLogs = await dbAll(`
        SELECT id, action, record_id, old_values, new_values, created_at
        FROM audit_log
        WHERE table_name = 'metric_periods'
        ORDER BY created_at ASC, id ASC
      `);
  
      // Reconstruct historical state (same logic as time-travel)
      const periodStates = {};
  
      // First pass: Find CREATE entries
      allAuditLogs.forEach(log => {
        if (log.action === 'CREATE') {
          const recordId = log.record_id;
          const newValues = JSON.parse(log.new_values || '{}');
          const createdAt = new Date(log.created_at);
  
          if (metricIds.includes(newValues.metric_id)) {
            periodStates[recordId] = {
              id: recordId,
              metric_id: newValues.metric_id,
              reporting_date: newValues.reporting_date,
              expected: newValues.expected || 0,
              target: newValues.target || 0,
              complete: createdAt <= targetDate ? (newValues.complete || 0) : 0,
              commentary: createdAt <= targetDate ? (newValues.commentary || null) : null
            };
          }
        }
      });
  
      // Add current periods that don't have CREATE audit entries
      currentPeriods.forEach(period => {
        if (!periodStates[period.id]) {
          periodStates[period.id] = {
            id: period.id,
            metric_id: period.metric_id,
            reporting_date: period.reporting_date,
            expected: period.expected,
            target: period.target,
            complete: 0,
            commentary: null
          };
        }
      });
  
      // Second pass: Apply UPDATE/DELETE entries up to target timestamp
      const relevantLogs = allAuditLogs.filter(log =>
        new Date(log.created_at) <= targetDate
      );
  
      relevantLogs.forEach(log => {
        const recordId = log.record_id;
  
        if (log.action === 'CREATE') {
          return; // Already handled
        } else if (log.action === 'UPDATE') {
          if (periodStates[recordId]) {
            const newValues = JSON.parse(log.new_values || '{}');
            const periodReportingDate = new Date(periodStates[recordId].reporting_date);
  
            if (newValues.complete !== undefined && periodReportingDate <= targetDate) {
              periodStates[recordId].complete = newValues.complete;
            }
            if (newValues.expected !== undefined) {
              periodStates[recordId].expected = newValues.expected;
            }
            if (newValues.target !== undefined) {
              periodStates[recordId].target = newValues.target;
            }
            if (newValues.commentary !== undefined) {
              periodStates[recordId].commentary = newValues.commentary;
            }
          }
        } else if (log.action === 'DELETE') {
          if (periodStates[recordId]) {
            delete periodStates[recordId];
          }
        }
      });
  
      // Now apply the historical state to the current database
      // This will create audit log entries for the revert action
      let updatedCount = 0;
      let unchangedCount = 0;
      let deletedCount = 0;
      let restoredCount = 0;
  
      // Track which periods exist in historical state
      const historicalPeriodIds = new Set(Object.keys(periodStates).map(id => parseInt(id)));
      const currentPeriodIds = new Set(currentPeriods.map(p => p.id));
  
      // Delete periods that don't exist in historical state but exist currently
      for (const currentPeriod of currentPeriods) {
        if (!historicalPeriodIds.has(currentPeriod.id)) {
          await dbRun('DELETE FROM metric_periods WHERE id = ?', [currentPeriod.id]);
  
          // Create audit log entry
          await dbRun(`
            INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            'metric_periods',
            currentPeriod.id,
            'DELETE',
            JSON.stringify(currentPeriod),
            null,
            userId
          ]);
  
          deletedCount++;
        }
      }
  
      // Update or restore periods from historical state
      for (const [periodId, historicalState] of Object.entries(periodStates)) {
        const currentPeriod = currentPeriods.find(p => p.id === parseInt(periodId));
  
        if (!currentPeriod) {
          // Period was deleted, restore it
          await dbRun(`
            INSERT INTO metric_periods (id, metric_id, reporting_date, expected, target, complete, commentary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            historicalState.id,
            historicalState.metric_id,
            historicalState.reporting_date,
            historicalState.expected,
            historicalState.target,
            historicalState.complete,
            historicalState.commentary
          ]);
  
          // Create audit log entry
          await dbRun(`
            INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            'metric_periods',
            historicalState.id,
            'CREATE',
            null,
            JSON.stringify(historicalState),
            userId
          ]);
  
          restoredCount++;
        } else {
          // Check if values are different
          const hasChanges =
            currentPeriod.expected !== historicalState.expected ||
            currentPeriod.target !== historicalState.target ||
            currentPeriod.complete !== historicalState.complete ||
            (currentPeriod.commentary || null) !== (historicalState.commentary || null);
  
          if (hasChanges) {
            // Update the period
            await dbRun(`
              UPDATE metric_periods
              SET expected = ?, target = ?, complete = ?, commentary = ?
              WHERE id = ?
            `, [
              historicalState.expected,
              historicalState.target,
              historicalState.complete,
              historicalState.commentary,
              historicalState.id
            ]);
  
            // Create audit log entry
            const changedValues = {};
            if (currentPeriod.expected !== historicalState.expected) changedValues.expected = historicalState.expected;
            if (currentPeriod.target !== historicalState.target) changedValues.target = historicalState.target;
            if (currentPeriod.complete !== historicalState.complete) changedValues.complete = historicalState.complete;
            if ((currentPeriod.commentary || null) !== (historicalState.commentary || null)) {
              changedValues.commentary = historicalState.commentary;
            }
  
            await dbRun(`
              INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              'metric_periods',
              historicalState.id,
              'UPDATE',
              JSON.stringify({
                expected: currentPeriod.expected,
                target: currentPeriod.target,
                complete: currentPeriod.complete,
                commentary: currentPeriod.commentary
              }),
              JSON.stringify(changedValues),
              userId
            ]);
  
            updatedCount++;
          } else {
            unchangedCount++;
          }
        }
      }
  
      res.json({
        success: true,
        message: `Reverted to state at ${targetDate.toISOString()}`,
        changes: {
          updated: updatedCount,
          deleted: deletedCount,
          restored: restoredCount,
          unchanged: unchangedCount
        }
      });
  
    } catch (err) {
      console.error('Revert error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== EXPORT =====
  const { exportAllData, setExportDatabaseFunctions } = require('./exportService');

  // Set database functions for export service to use the correct database
  setExportDatabaseFunctions(dbAll);

  // Manual export trigger (admin only)
  app.post('/api/export', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can trigger exports' });
      }
  
      const filepath = await exportAllData();
      const filename = require('path').basename(filepath);
  
      logger.info('EXPORT', 'Export completed successfully', {
        userId: req.user.userId,
        email: req.user.email,
        filename
      });
  
      res.json({
        message: 'Export completed successfully',
        filename: filename
      });
    } catch (err) {
      logger.exception('EXPORT', 'Error exporting data', err, { userId: req.user.userId });
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== IMPORT =====
  const multer = require('multer');
  const { importDataFromFile, generateImportTemplate, ImportValidationError, setDatabaseFunctions } = require('./importService');

  // Set database functions for import service to use the correct database
  setDatabaseFunctions(dbGet, dbAll, dbRun);
  
  // Configure multer for file uploads
  const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx) are allowed'));
      }
    }
  });
  
  // Download import template
  app.get('/api/import/template', authenticateToken, async (req, res) => {
    try {
      // Check if user can create projects (admin or PM)
      if (!canCreateProject(req.user)) {
        return res.status(403).json({ error: 'Only admins and project managers can import data' });
      }
  
      const workbook = await generateImportTemplate();
      const filename = 'progress-tracker-import-template.xlsx';
  
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Template generation error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // Import data from Excel file
  app.post('/api/import', authenticateToken, upload.single('file'), async (req, res) => {
    let filePath = null;
  
    try {
      // Check if user can create projects (admin or PM)
      if (!canCreateProject(req.user)) {
        return res.status(403).json({ error: 'Only admins and project managers can import data' });
      }
  
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
  
      filePath = req.file.path;
  
      console.log(`Processing import file: ${req.file.originalname}`);
  
      // Process the import
      const results = await importDataFromFile(filePath, req.user.userId);
  
      // Log the import action
      await logAudit(req.user, 'IMPORT', 'projects', null, null,
        {
          filename: req.file.originalname,
          results: results
        },
        `Imported data from ${req.file.originalname}: ${results.projectsCreated} projects created, ${results.projectsUpdated} updated, ${results.metricsCreated} metrics created, ${results.periodsCreated} periods created, ${results.periodsUpdated} periods updated`,
        req.ip
      );
  
      res.json({
        success: true,
        message: 'Import completed successfully',
        results: results
      });
  
    } catch (err) {
      logger.exception('IMPORT', 'Error importing data', err, {
        filename: req.file?.originalname,
        userId: req.user.userId
      });
  
      if (err instanceof ImportValidationError) {
        return res.status(400).json({
          error: 'Import validation failed',
          validationErrors: err.errors
        });
      }
  
      res.status(500).json({ error: err.message });
    } finally {
      // Clean up uploaded file
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });
  
  // ===== CATCH-ALL ROUTE (must be last) =====
  // Serve index.html for all non-API routes to support React Router
  if (fs.existsSync(frontendPath)) {
    app.get('*', (req, res) => {
      // Don't catch API routes
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  } else {
    // In development mode, provide helpful message
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      const os = require('os');
      const hostname = os.hostname();
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Progress Tracker API</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 100px auto; padding: 20px; }
              h1 { color: #333; }
              .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
              a { color: #0066cc; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>Progress Tracker API Server</h1>
            <div class="info">
              <p><strong>Status:</strong> Running ✅</p>
              <p><strong>API Endpoint:</strong> <code>/api</code></p>
            </div>
            <p>The frontend application is running separately in development mode.</p>
            <p>Access the app at: <a href="http://${hostname}:5173">http://${hostname}:5173</a></p>
          </body>
        </html>
      `);
    });
  }
  
  // ===== DATABASE MIGRATION FUNCTION =====
  async function runMigrations() {
    // Migration: Add role column if it doesn't exist
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'`);
      console.log('✅ Added role column to users table');
    } catch (err) {
      // Column already exists, that's fine
    }
  
    // Migration: Clean up invalid roles and convert to valid ones
    try {
      // Convert 'editor' to 'pm' (Project Manager is the closest equivalent)
      await dbRun(`UPDATE users SET role = 'pm' WHERE role = 'editor'`);
      // Set any null or empty roles to 'viewer'
      await dbRun(`UPDATE users SET role = 'viewer' WHERE role IS NULL OR role = ''`);
      console.log('✅ Cleaned up user roles');
    } catch (err) {
      console.error('Error updating user roles:', err);
    }

    // Migration: Add unique constraint on user name
    try {
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name)`);
      console.log('✅ Added unique constraint on user name');
    } catch (err) {
      // Index already exists or duplicate names exist
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('⚠️ Cannot add unique name constraint - duplicate names exist');
      }
    }
  
    // Migration: Add tolerance columns to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN amber_tolerance REAL DEFAULT 5.0`);
      await dbRun(`ALTER TABLE metrics ADD COLUMN red_tolerance REAL DEFAULT 10.0`);
      console.log('✅ Added tolerance columns to metrics table');
    } catch (err) {
      // Columns already exist, that's fine
    }
  
    // Migration: Add metric_type column to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN metric_type TEXT DEFAULT 'standard'`);
      console.log('✅ Added metric_type column to metrics table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add description column to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN description TEXT`);
      console.log('✅ Added description column to metrics table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add commentary column to metric_periods table
    try {
      await dbRun(`ALTER TABLE metric_periods ADD COLUMN commentary TEXT`);
      console.log('✅ Added commentary column to metric_periods table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add target column to metric_periods table for scope change tracking
    try {
      await dbRun(`ALTER TABLE metric_periods ADD COLUMN target REAL`);
      console.log('✅ Added target column to metric_periods table');

      // Populate target column with metric's final_target for existing periods
      await dbRun(`
        UPDATE metric_periods
        SET target = (
          SELECT m.final_target
          FROM metrics m
          WHERE m.id = metric_periods.metric_id
        )
        WHERE target IS NULL
      `);
      console.log('✅ Populated target values from metrics.final_target');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Create project_links table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS project_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          label TEXT NOT NULL,
          url TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links(project_id)`);
      console.log('✅ Created project_links table');
    } catch (err) {
      // Table already exists, that's fine
    }
  
    // Migration: Add start_date and end_date to projects table
    try {
      await dbRun(`ALTER TABLE projects ADD COLUMN start_date DATE`);
      await dbRun(`ALTER TABLE projects ADD COLUMN end_date DATE`);
      console.log('✅ Added date columns to projects table');
    } catch (err) {
      // Columns already exist, that's fine
    }
  
    // Migration: Create portfolios table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS portfolios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT DEFAULT '#3b82f6',
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created portfolios table');
    } catch (err) {
      console.error('Error creating portfolios table:', err);
    }
  
    // Migration: Add portfolio_id to projects table
    try {
      await dbRun(`ALTER TABLE projects ADD COLUMN portfolio_id INTEGER REFERENCES portfolios(id)`);
      console.log('✅ Added portfolio_id column to projects table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add secondary_pm to projects table
    try {
      await dbRun(`ALTER TABLE projects ADD COLUMN secondary_pm TEXT`);
      console.log('✅ Added secondary_pm column to projects table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Create feedback table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'open',
          pm_response TEXT,
          responded_by INTEGER,
          responded_at DATETIME,
          resolved_by INTEGER,
          resolved_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (responded_by) REFERENCES users(id),
          FOREIGN KEY (resolved_by) REFERENCES users(id)
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);
      console.log('✅ Created feedback table');
    } catch (err) {
      console.error('Error creating feedback table:', err);
    }

    // Migration: Convert feedback to text-only (combine title and description into text)
    try {
      const feedbackCols = await dbAll(`PRAGMA table_info(feedback)`);
      const hasTextColumn = feedbackCols.some(col => col.name === 'text');
      const hasTitleColumn = feedbackCols.some(col => col.name === 'title');

      if (hasTitleColumn && !hasTextColumn) {
        // Step 1: Add text column
        await dbRun(`ALTER TABLE feedback ADD COLUMN text TEXT`);

        // Step 2: Migrate existing data
        await dbRun(`
          UPDATE feedback
          SET text = CASE
            WHEN title IS NOT NULL AND description IS NOT NULL
            THEN title || ': ' || description
            WHEN title IS NOT NULL THEN title
            WHEN description IS NOT NULL THEN description
            ELSE ''
          END
        `);

        // Step 3: Create new table without title/description
        await dbRun(`
          CREATE TABLE feedback_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT,
            status TEXT DEFAULT 'open',
            pm_response TEXT,
            responded_by INTEGER,
            responded_at DATETIME,
            resolved_by INTEGER,
            resolved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (responded_by) REFERENCES users(id),
            FOREIGN KEY (resolved_by) REFERENCES users(id)
          )
        `);

        // Step 4: Copy all data to new table
        await dbRun(`
          INSERT INTO feedback_new (id, user_id, text, status, pm_response, responded_by,
                                     responded_at, resolved_by, resolved_at, created_at, updated_at)
          SELECT id, user_id, text, status, pm_response, responded_by,
                 responded_at, resolved_by, resolved_at, created_at, updated_at
          FROM feedback
        `);

        // Step 5: Drop old table
        await dbRun(`DROP TABLE feedback`);

        // Step 6: Rename new table
        await dbRun(`ALTER TABLE feedback_new RENAME TO feedback`);

        // Step 7: Recreate indexes
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);

        console.log('✅ Migrated feedback to text-only format');
      }
    } catch (err) {
      console.error('Error migrating feedback to text-only:', err);
    }

    // Migration: Add project_id to feedback table
    try {
      const feedbackCols = await dbAll(`PRAGMA table_info(feedback)`);
      const hasProjectId = feedbackCols.some(col => col.name === 'project_id');

      if (!hasProjectId) {
        await dbRun(`ALTER TABLE feedback ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id)`);
        console.log('✅ Added project_id to feedback table');
      }
    } catch (err) {
      console.error('Error adding project_id to feedback:', err);
    }

    // Migration: Create page_views table for analytics
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS page_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          path TEXT NOT NULL,
          session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id)`);
      console.log('✅ Created page_views table');
    } catch (err) {
      // Table already exists, that's fine
    }

    // Migration: Create recovery_plans table for Return to Green plans
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS recovery_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          plan_text TEXT NOT NULL,
          target_recovery_date DATE,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
          completed_at DATETIME,
          completion_notes TEXT,
          FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_recovery_plans_metric ON recovery_plans(metric_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_recovery_plans_project ON recovery_plans(project_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_recovery_plans_status ON recovery_plans(status)`);
      console.log('✅ Created recovery_plans table');
    } catch (err) {
      // Table already exists, that's fine
    }

    // Create default admin user if none exists
    const existingAdmin = await dbGet('SELECT id FROM users WHERE email = ? OR name = ?', ['admin@example.com', 'Admin User']);
    if (!existingAdmin) {
      const hash = await hashPassword('admin123');
      await dbRun('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', ['admin@example.com', 'Admin User', hash, 'admin']);
      console.log('✅ Created default admin user: admin@example.com / admin123');
    }

    console.log('✅ Database ready at backend/data/progress-tracker.db');
  }

  // Run migrations immediately
  runMigrations().catch(err => {
    console.error('Error running migrations:', err);
  });

  // Return app and database functions for use (server start moved outside)
  return { app, PORT, dbRun, dbGet, dbAll, generateConsistencyFeedback };
}

// ===== DEFAULT INSTANCE AND SERVER START =====
// Create default instance for backward compatibility
const defaultInstance = createApp();
const app = defaultInstance.app;
const PORT = defaultInstance.PORT;
const generateConsistencyFeedback = defaultInstance.generateConsistencyFeedback;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);

    // Start the daily export and consistency feedback schedulers
    startScheduler(generateConsistencyFeedback);
  });
}

// Export app for testing (backward compatibility)
module.exports = app;
// Export createApp for test isolation
module.exports.createApp = createApp;
