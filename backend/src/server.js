const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const path = require('path');
const NodeCache = require('node-cache');

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

  // Initialize cache with default TTL of 5 minutes
  const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

  // Cache key generators
  const cacheKeys = {
    projectData: (projectId) => `project_data_${projectId}`,
    portfolioReport: (portfolioId) => `portfolio_report_${portfolioId}`,
    analyticsPerformance: (days) => `analytics_performance_${days}`
  };

  // Cache invalidation helper - invalidates all related caches when data changes
  function invalidateProjectCache(projectId) {
    cache.del(cacheKeys.projectData(projectId));
    // Also invalidate portfolio reports that might include this project
    cache.keys().forEach(key => {
      if (key.startsWith('portfolio_report_')) {
        cache.del(key);
      }
    });
    logger.debug(`Cache invalidated for project ${projectId}`);
  }

  // Define permission functions with access to this database instance
  const ROLES = {
    ADMIN: 'admin',
    PM: 'pm',
    EDITOR: 'editor' // Legacy role - treat as PM
  };

  // Check if user can edit a project (space-scoped for admins)
  async function canEditProject(userId, projectId) {
    const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

    // System admins can edit anything across all spaces
    if (user.is_system_admin === 1) {
      return true;
    }

    // Regular admins: check space assignment
    if (user.role === ROLES.ADMIN) {
      const spaceId = await getProjectSpaceId(projectId);

      // If project has no space, admin can edit (legacy/unassigned projects)
      if (!spaceId) {
        return true;
      }

      return await isAdminForSpace(userId, spaceId);
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

  // Check if user is a system admin (cross-space/global permissions)
  function isSystemAdmin(user) {
    return user && user.is_system_admin === 1;
  }

  // Check if admin is assigned to a specific space
  async function isAdminForSpace(userId, spaceId) {
    const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

    if (!user || user.role !== ROLES.ADMIN) {
      return false;
    }

    // System admins have access to all spaces
    if (user.is_system_admin === 1) {
      return true;
    }

    // Check space_admin_assignments table
    const assignment = await dbGet(
      'SELECT id FROM space_admin_assignments WHERE user_id = ? AND space_id = ?',
      [userId, spaceId]
    );

    return !!assignment;
  }

  // Get the space ID for a project (via portfolio)
  async function getProjectSpaceId(projectId) {
    const result = await dbGet(`
      SELECT p.space_id
      FROM projects pr
      JOIN portfolios p ON pr.portfolio_id = p.id
      WHERE pr.id = ?
    `, [projectId]);

    return result ? result.space_id : null;
  }

  // Get all spaces an admin has access to
  async function getAdminSpaces(userId) {
    const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

    if (!user || user.role !== ROLES.ADMIN) {
      return [];
    }

    // System admins have access to all spaces
    if (user.is_system_admin === 1) {
      return await dbAll('SELECT id, name FROM spaces ORDER BY display_order');
    }

    // Regular admins get assigned spaces only
    return await dbAll(`
      SELECT s.id, s.name
      FROM spaces s
      INNER JOIN space_admin_assignments sa ON s.id = sa.space_id
      WHERE sa.user_id = ?
      ORDER BY s.display_order
    `, [userId]);
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

  // Frontend error logging endpoint (no auth required for error reporting)
  app.post('/api/log-frontend-error', async (req, res) => {
    const { error, stack, componentStack, timestamp } = req.body;
    console.error('=== FRONTEND ERROR LOGGED ===');
    console.error('Timestamp:', timestamp);
    console.error('Error:', error);
    console.error('Stack:', stack);
    console.error('Component Stack:', componentStack);
    console.error('User Agent:', req.headers['user-agent']);
    console.error('IP:', req.ip);
    res.status(200).json({ success: true });
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
  
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, name: user.name, isSystemAdmin: user.is_system_admin === 1 }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, user: { id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role, isSystemAdmin: user.is_system_admin === 1, default_space_id: user.default_space_id } });
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
        }
        return res.status(400).json({ error: 'User already exists' });
      }
      console.error('Registration error:', err);
      res.status(400).json({ error: err.message || 'Registration failed' });
    }
  });
  
  // Check if a name is available (for registration and profile updates)
  app.get('/api/auth/check-name', async (req, res) => {
    try {
      const { name, excludeUserId } = req.query;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      let query = 'SELECT id FROM users WHERE name = ?';
      let params = [name.trim()];

      // If excludeUserId is provided, exclude that user (for profile updates)
      if (excludeUserId) {
        query += ' AND id != ?';
        params.push(parseInt(excludeUserId));
      }

      const existingUser = await dbGet(query, params);

      res.json({
        available: !existingUser,
        message: existingUser ? 'This name is already taken. Please choose a different name.' : 'Name is available'
      });
    } catch (err) {
      console.error('Check name error:', err);
      res.status(500).json({ error: err.message });
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

  // Token refresh endpoint - allows refreshing expired tokens within grace period
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Decode token without verification to check expiry
      const decoded = jwt.decode(token);

      if (!decoded || !decoded.userId) {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      // Check if token is within grace period (30 days after expiry)
      const now = Math.floor(Date.now() / 1000);
      const gracePeriod = 30 * 24 * 60 * 60; // 30 days in seconds

      if (decoded.exp && (now - decoded.exp) > gracePeriod) {
        logger.auth.tokenRefreshFailed(decoded.userId, 'Token expired beyond grace period');
        return res.status(401).json({ error: 'Token expired beyond grace period. Please log in again.' });
      }

      // Verify user still exists and is active
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.userId]);

      if (!user) {
        logger.auth.tokenRefreshFailed(decoded.userId, 'User not found');
        return res.status(401).json({ error: 'User not found. Please log in again.' });
      }

      // Issue new token with same payload but fresh expiry
      const newToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          isSystemAdmin: user.is_system_admin === 1
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      logger.auth.tokenRefreshSuccess(user.id, user.email);

      res.json({
        token: newToken,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isSystemAdmin: user.is_system_admin === 1,
          default_space_id: user.default_space_id
        }
      });
    } catch (err) {
      logger.error('AUTH', 'Token refresh error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to refresh token' });
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
      const user = await dbGet('SELECT id, email, name, role, created_at, default_space_id FROM users WHERE id = ?', [userId]);

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

  // Update user's default space
  app.put('/api/auth/default-space', authenticateToken, async (req, res) => {
    try {
      const { spaceId } = req.body;
      const userId = req.user.userId;

      // Validate spaceId is provided
      if (spaceId === undefined || spaceId === null) {
        return res.status(400).json({ error: 'spaceId is required' });
      }

      // Verify the space exists
      const space = await dbGet('SELECT id FROM spaces WHERE id = ?', [spaceId]);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }

      await dbRun(
        'UPDATE users SET default_space_id = ? WHERE id = ?',
        [spaceId, userId]
      );

      res.json({ message: 'Default space updated successfully', default_space_id: spaceId });
    } catch (err) {
      console.error('Update default space error:', err);
      res.status(500).json({ error: 'Failed to update default space' });
    }
  });

  // ===== SPACES =====

  // Get all spaces
  app.get('/api/spaces', async (req, res) => {
    try {
      const spaces = await dbAll(`
        SELECT s.*,
          (SELECT COUNT(*) FROM projects p
           JOIN portfolios po ON p.portfolio_id = po.id
           WHERE po.space_id = s.id) as project_count
        FROM spaces s
        ORDER BY s.display_order, s.name
      `);
      res.json(spaces);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new space (admin only)
  app.post('/api/spaces', authenticateToken, async (req, res) => {
    try {
      const { name, description, color, display_order } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Space name is required' });
      }

      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can create spaces' });
      }

      // Check for duplicate space name
      const existingSpace = await dbGet('SELECT id FROM spaces WHERE name = ?', [name]);
      if (existingSpace) {
        return res.status(400).json({ error: 'A space with this name already exists' });
      }

      const result = await dbRun(
        'INSERT INTO spaces (name, description, color, display_order) VALUES (?, ?, ?, ?)',
        [name, description || null, color || '#6366f1', display_order || 0]
      );

      await logAudit(
        req.user,
        'CREATE',
        'spaces',
        result.lastID,
        null,
        { name, description, color, display_order },
        `Created space: ${name}`,
        req.ip
      );

      logger.asset.create(req.user, 'space', { name, description, color }, null);

      res.status(201).json({ id: result.lastID, name, description, color, display_order });
    } catch (err) {
      logger.exception('SPACE', 'Error creating space', err, { requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });

  // Update a space (admin only)
  app.put('/api/spaces/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, display_order } = req.body;

      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can update spaces' });
      }

      const oldSpace = await dbGet('SELECT * FROM spaces WHERE id = ?', [id]);
      if (!oldSpace) {
        return res.status(404).json({ error: 'Space not found' });
      }

      await dbRun(
        'UPDATE spaces SET name = ?, description = ?, color = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description, color, display_order, id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'spaces',
        id,
        oldSpace,
        { name, description, color, display_order },
        `Updated space: ${name}`,
        req.ip
      );

      res.json({ id, name, description, color, display_order });
    } catch (err) {
      console.error('Update space error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a space (admin only)
  app.delete('/api/spaces/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can delete spaces' });
      }

      const space = await dbGet('SELECT * FROM spaces WHERE id = ?', [id]);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }

      // Set space_id to NULL for all portfolios in this space
      await dbRun('UPDATE portfolios SET space_id = NULL WHERE space_id = ?', [id]);

      await dbRun('DELETE FROM spaces WHERE id = ?', [id]);

      await logAudit(
        req.user,
        'DELETE',
        'spaces',
        id,
        space,
        null,
        `Deleted space: ${space.name}`,
        req.ip
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Delete space error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== PORTFOLIOS =====
  app.get('/api/portfolios', async (req, res) => {
    try {
      const portfolios = await dbAll(`
        SELECT p.*, u.name as manager_name,
               (SELECT COUNT(*) FROM projects WHERE portfolio_id = p.id) as project_count
        FROM portfolios p
        LEFT JOIN users u ON p.manager_id = u.id
        ORDER BY p.display_order, p.name
      `);
      res.json(portfolios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/portfolios', authenticateToken, async (req, res) => {
    try {
      const { name, description, color, display_order, space_id, manager_id } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Portfolio name is required' });
      }

      // Check if user has permission to create portfolios (admin only)
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can create portfolios' });
      }

      const result = await dbRun(
        'INSERT INTO portfolios (name, description, color, display_order, space_id, manager_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, color || '#3b82f6', display_order || 0, space_id || null, manager_id || null]
      );

      await logAudit(
        req.user,
        'CREATE',
        'portfolios',
        result.lastID,
        null,
        { name, description, color, display_order, space_id, manager_id },
        `Created portfolio: ${name}`,
        req.ip
      );

      logger.asset.create(req.user, 'portfolio', { name, description, color, space_id, manager_id }, null);

      res.status(201).json({ id: result.lastID, name, description, color, display_order, space_id, manager_id });
    } catch (err) {
      logger.exception('PORTFOLIO', 'Error creating portfolio', err, { requestBody: req.body });
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/portfolios/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, display_order, space_id, manager_id } = req.body;

      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can update portfolios' });
      }

      const oldPortfolio = await dbGet('SELECT * FROM portfolios WHERE id = ?', [id]);
      if (!oldPortfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      await dbRun(
        'UPDATE portfolios SET name = ?, description = ?, color = ?, display_order = ?, space_id = ?, manager_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description, color, display_order, space_id || null, manager_id || null, id]
      );

      await logAudit(
        req.user,
        'UPDATE',
        'portfolios',
        id,
        oldPortfolio,
        { name, description, color, display_order, space_id, manager_id },
        `Updated portfolio: ${name}`,
        req.ip
      );

      res.json({ id, name, description, color, display_order, space_id, manager_id });
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
      const cacheKey = cacheKeys.portfolioReport(id);

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for portfolio report: ${id}`);
        return res.json(cached);
      }

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
          SELECT m.id, m.name, m.amber_tolerance, m.red_tolerance, m.start_date, m.end_date, m.final_target
          FROM metrics m
          WHERE m.project_id = ?
          ORDER BY COALESCE(m.display_order, 999), m.name
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

          // Check if final period's expected falls short of target (no plan to meet target)
          // This should make the metric red even if current variance is acceptable
          let missesTarget = false;
          if (periods.length > 0) {
            const finalPeriod = periods[periods.length - 1];
            const finalExpected = finalPeriod.expected || 0;
            const finalTarget = finalPeriod.target || 0;
            if (finalTarget > 0 && finalExpected < finalTarget) {
              ragStatus = 'red';
              missesTarget = true;
            }
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

          // Build trend data from the last 6 periods (or all if less than 6)
          const trendData = periods.slice(-6).map(p => ({
            reporting_date: p.reporting_date,
            complete: p.complete,
            expected: p.expected,
            target: p.target
          }));

          metricsWithStatus.push({
            id: metric.id,
            name: metric.name,
            ragStatus,
            variance,
            variancePercent,
            complete: currentPeriod.complete,
            expected: currentPeriod.expected,
            reporting_date: currentPeriod.reporting_date,
            latestComment,
            missesTarget,
            trendData
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

      // Get all open risks and issues for projects in this portfolio
      const projectIds = projects.map(p => p.id);
      let portfolioRisks = [];
      let portfolioIssues = [];

      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => '?').join(',');

        portfolioRisks = await dbAll(`
          SELECT c.*, p.name as project_name
          FROM craids c
          JOIN projects p ON c.project_id = p.id
          WHERE c.project_id IN (${placeholders})
            AND c.type = 'risk'
            AND c.status != 'closed'
          ORDER BY
            CASE c.priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            c.created_at DESC
        `, projectIds);

        portfolioIssues = await dbAll(`
          SELECT c.*, p.name as project_name
          FROM craids c
          JOIN projects p ON c.project_id = p.id
          WHERE c.project_id IN (${placeholders})
            AND c.type = 'issue'
            AND c.status != 'closed'
          ORDER BY
            CASE c.priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            c.created_at DESC
        `, projectIds);
      }

      // Add risk and issue counts to summary
      summary.openRisks = portfolioRisks.length;
      summary.openIssues = portfolioIssues.length;

      const result = {
        portfolio,
        summary,
        redProjects,
        amberProjects,
        greenProjects,
        risks: portfolioRisks,
        issues: portfolioIssues
      };

      // Cache for 10 minutes
      cache.set(cacheKey, result, 600);
      logger.debug(`Cache miss for portfolio report: ${id}, cached result`);

      res.json(result);
    } catch (err) {
      console.error('Portfolio report error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== ALL SPACES REPORT =====
  app.get('/api/reports/all', async (req, res) => {
    try {
      // Get all projects across all portfolios
      const projects = await dbAll(`
        SELECT p.id, p.name, p.description, p.initiative_manager, p.start_date, p.end_date, p.portfolio_id
        FROM projects p
        ORDER BY p.name
      `);

      // Get all portfolios for the portfolio map
      const portfolios = await dbAll(`SELECT id, name, color FROM portfolios`);
      const portfolioMap = {};
      portfolios.forEach(p => {
        portfolioMap[p.id] = p;
      });

      const projectsWithMetrics = [];

      for (const project of projects) {
        // Get all metrics for this project
        const metrics = await dbAll(`
          SELECT m.id, m.name, m.amber_tolerance, m.red_tolerance, m.start_date, m.end_date, m.final_target
          FROM metrics m
          WHERE m.project_id = ?
          ORDER BY COALESCE(m.display_order, 999), m.name
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
          const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriod.id);
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

          // Check if final period's expected falls short of target (no plan to meet target)
          // This should make the metric red even if current variance is acceptable
          let missesTarget = false;
          if (periods.length > 0) {
            const finalPeriod = periods[periods.length - 1];
            const finalExpected = finalPeriod.expected || 0;
            const finalTarget = finalPeriod.target || 0;
            if (finalTarget > 0 && finalExpected < finalTarget) {
              ragStatus = 'red';
              missesTarget = true;
            }
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

          // Build trend data from the last 6 periods (or all if less than 6)
          const trendData = periods.slice(-6).map(p => ({
            reporting_date: p.reporting_date,
            complete: p.complete,
            expected: p.expected,
            target: p.target
          }));

          metricsWithStatus.push({
            id: metric.id,
            name: metric.name,
            ragStatus,
            variance,
            variancePercent,
            complete: currentPeriod.complete,
            expected: currentPeriod.expected,
            reporting_date: currentPeriod.reporting_date,
            latestComment,
            missesTarget,
            trendData
          });
        }

        // Only include projects that have metrics
        if (metricsWithStatus.length > 0) {
          // Sort metrics by variance (ascending, so most negative/worst first)
          metricsWithStatus.sort((a, b) => a.variance - b.variance);

          const portfolio = portfolioMap[project.portfolio_id];
          projectsWithMetrics.push({
            id: project.id,
            name: project.name,
            description: project.description,
            initiative_manager: project.initiative_manager,
            start_date: project.start_date,
            end_date: project.end_date,
            portfolio_name: portfolio ? portfolio.name : null,
            portfolio_color: portfolio ? portfolio.color : null,
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
        summary,
        redProjects,
        amberProjects,
        greenProjects
      });
    } catch (err) {
      console.error('All spaces report error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== SPACES REPORT =====
  app.get('/api/spaces/:id/report', async (req, res) => {
    try {
      const { id } = req.params;

      // Get space info
      const space = await dbGet('SELECT * FROM spaces WHERE id = ?', [id]);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }

      // Get all portfolios in this space
      const portfolios = await dbAll(`
        SELECT id, name, color
        FROM portfolios
        WHERE space_id = ?
      `, [id]);

      const portfolioIds = portfolios.map(p => p.id);
      const portfolioMap = {};
      portfolios.forEach(p => {
        portfolioMap[p.id] = p;
      });

      if (portfolioIds.length === 0) {
        // No portfolios in this space
        return res.json({
          space,
          summary: {
            totalProjects: 0,
            redCount: 0,
            amberCount: 0,
            greenCount: 0,
            totalMetrics: 0
          },
          redProjects: [],
          amberProjects: [],
          greenProjects: []
        });
      }

      // Get all projects in these portfolios with their metrics
      const placeholders = portfolioIds.map(() => '?').join(',');
      const projects = await dbAll(`
        SELECT p.id, p.name, p.description, p.initiative_manager, p.start_date, p.end_date, p.portfolio_id
        FROM projects p
        WHERE p.portfolio_id IN (${placeholders})
        ORDER BY p.name
      `, portfolioIds);

      const projectsWithMetrics = [];

      for (const project of projects) {
        // Get all metrics for this project
        const metrics = await dbAll(`
          SELECT m.id, m.name, m.amber_tolerance, m.red_tolerance, m.start_date, m.end_date, m.final_target
          FROM metrics m
          WHERE m.project_id = ?
          ORDER BY COALESCE(m.display_order, 999), m.name
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

          // Check if final period's expected falls short of target (no plan to meet target)
          // This should make the metric red even if current variance is acceptable
          let missesTarget = false;
          if (periods.length > 0) {
            const finalPeriod = periods[periods.length - 1];
            const finalExpected = finalPeriod.expected || 0;
            const finalTarget = finalPeriod.target || 0;
            if (finalTarget > 0 && finalExpected < finalTarget) {
              ragStatus = 'red';
              missesTarget = true;
            }
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

          // Build trend data from the last 6 periods (or all if less than 6)
          const trendData = periods.slice(-6).map(p => ({
            reporting_date: p.reporting_date,
            complete: p.complete,
            expected: p.expected,
            target: p.target
          }));

          metricsWithStatus.push({
            id: metric.id,
            name: metric.name,
            ragStatus,
            variance,
            variancePercent,
            complete: currentPeriod.complete,
            expected: currentPeriod.expected,
            reporting_date: currentPeriod.reporting_date,
            latestComment,
            missesTarget,
            trendData
          });
        }

        // Only include projects that have metrics
        if (metricsWithStatus.length > 0) {
          // Sort metrics by variance (ascending, so most negative/worst first)
          metricsWithStatus.sort((a, b) => a.variance - b.variance);

          const portfolio = portfolioMap[project.portfolio_id];
          projectsWithMetrics.push({
            id: project.id,
            name: project.name,
            description: project.description,
            initiative_manager: project.initiative_manager,
            start_date: project.start_date,
            end_date: project.end_date,
            portfolio_name: portfolio ? portfolio.name : null,
            portfolio_color: portfolio ? portfolio.color : null,
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
        space,
        summary,
        redProjects,
        amberProjects,
        greenProjects
      });
    } catch (err) {
      console.error('Space report error:', err);
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

  // Get recent feedback for the logged-in user's projects
  app.get('/api/feedback/my-projects', authenticateToken, async (req, res) => {
    try {
      const { limit = 10, days = 30 } = req.query;

      // Get user name from token, or look it up from database if not present (backwards compatibility)
      let userName = req.user.name;
      if (!userName) {
        const user = await dbGet('SELECT name FROM users WHERE id = ?', [req.user.userId]);
        userName = user?.name;
      }

      if (!userName) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Get unresolved feedback for projects where user is initiative_manager, secondary_pm, or portfolio manager
      const feedback = await dbAll(`
        SELECT f.*,
               u.name as user_name,
               u.email as user_email,
               p.name as project_name,
               p.id as project_id,
               r.name as responder_name,
               s.name as resolver_name,
               port.name as portfolio_name
        FROM feedback f
        JOIN projects p ON f.project_id = p.id
        LEFT JOIN portfolios port ON p.portfolio_id = port.id
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN users r ON f.responded_by = r.id
        LEFT JOIN users s ON f.resolved_by = s.id
        WHERE (p.initiative_manager = ? OR p.secondary_pm = ? OR port.manager_id = ?)
          AND f.status != 'resolved'
        ORDER BY f.created_at DESC
        LIMIT ?
      `, [userName, userName, req.user.id, parseInt(limit)]);

      res.json(feedback);
    } catch (err) {
      console.error('Get my projects feedback error:', err);
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

  // ===== MILESTONES =====

  // Get milestones for a project
  app.get('/api/milestones', async (req, res) => {
    try {
      const { project_id } = req.query;

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' });
      }

      const milestones = await dbAll(
        `SELECT * FROM milestones
         WHERE project_id = ?
         ORDER BY target_date ASC, display_order ASC`,
        [project_id]
      );

      res.json(milestones);
    } catch (err) {
      console.error('Get milestones error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new milestone
  app.post('/api/milestones', authenticateToken, async (req, res) => {
    try {
      const { project_id, title, description, target_date, display_order } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' });
      }

      if (!target_date) {
        return res.status(400).json({ error: 'target_date is required' });
      }

      const result = await dbRun(
        `INSERT INTO milestones (project_id, title, description, target_date, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [project_id, title.trim(), description || null, target_date, display_order || 0]
      );

      const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [result.lastID]);

      // Log to audit trail
      await dbRun(
        `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values, description, created_at)
         VALUES (?, ?, 'CREATE', 'milestones', ?, ?, ?, datetime('now'))`,
        [
          req.user.userId,
          req.user.email,
          result.lastID,
          JSON.stringify(milestone),
          `Created milestone: ${title}`
        ]
      );

      res.json(milestone);
    } catch (err) {
      console.error('Create milestone error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update a milestone
  app.put('/api/milestones/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, target_date, completed, completed_date, display_order } = req.body;

      const oldMilestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [id]);
      if (!oldMilestone) {
        return res.status(404).json({ error: 'Milestone not found' });
      }

      await dbRun(
        `UPDATE milestones
         SET title = ?,
             description = ?,
             target_date = ?,
             completed = ?,
             completed_date = ?,
             display_order = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          title !== undefined ? title : oldMilestone.title,
          description !== undefined ? description : oldMilestone.description,
          target_date !== undefined ? target_date : oldMilestone.target_date,
          completed !== undefined ? completed : oldMilestone.completed,
          completed_date !== undefined ? completed_date : oldMilestone.completed_date,
          display_order !== undefined ? display_order : oldMilestone.display_order,
          id
        ]
      );

      const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [id]);

      // Log to audit trail
      await dbRun(
        `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
         VALUES (?, ?, 'UPDATE', 'milestones', ?, ?, ?, ?, datetime('now'))`,
        [
          req.user.userId,
          req.user.email,
          id,
          JSON.stringify(oldMilestone),
          JSON.stringify(milestone),
          `Updated milestone: ${milestone.title}`
        ]
      );

      res.json(milestone);
    } catch (err) {
      console.error('Update milestone error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a milestone
  app.delete('/api/milestones/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [id]);
      if (!milestone) {
        return res.status(404).json({ error: 'Milestone not found' });
      }

      await dbRun('DELETE FROM milestones WHERE id = ?', [id]);

      // Log to audit trail
      await dbRun(
        `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, description, created_at)
         VALUES (?, ?, 'DELETE', 'milestones', ?, ?, ?, datetime('now'))`,
        [
          req.user.userId,
          req.user.email,
          id,
          JSON.stringify(milestone),
          `Deleted milestone: ${milestone.title}`
        ]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Delete milestone error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== RECOVERY PLANS (Return to Green) =====

  // Get recovery plans for a metric or project
  app.get('/api/recovery-plans', optionalAuthenticateToken, async (req, res) => {
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

  // ===== BACKLOG =====
  // Get all backlog items (with portfolio info - space derived from portfolio)
  app.get('/api/backlog', async (req, res) => {
    try {
      const { space_id } = req.query;
      let query = `
        SELECT b.id, b.name, b.description, b.portfolio_id, b.initiative_manager,
               b.priority, b.created_by, b.created_at, b.updated_at,
               b.start_date, b.end_date,
               p.name as portfolio_name,
               p.color as portfolio_color,
               p.space_id,
               s.name as space_name,
               u.name as created_by_name
        FROM backlog_items b
        LEFT JOIN portfolios p ON b.portfolio_id = p.id
        LEFT JOIN spaces s ON p.space_id = s.id
        LEFT JOIN users u ON b.created_by = u.id
      `;
      let params = [];

      if (space_id) {
        query += ' WHERE p.space_id = ?';
        params.push(space_id);
      }

      query += ' ORDER BY b.created_at DESC';

      const items = await dbAll(query, params);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single backlog item
  app.get('/api/backlog/:id', async (req, res) => {
    try {
      const item = await dbGet(`
        SELECT b.*,
               p.name as portfolio_name,
               p.color as portfolio_color,
               u.name as created_by_name
        FROM backlog_items b
        LEFT JOIN portfolios p ON b.portfolio_id = p.id
        LEFT JOIN users u ON b.created_by = u.id
        WHERE b.id = ?
      `, [req.params.id]);

      if (!item) {
        return res.status(404).json({ error: 'Backlog item not found' });
      }

      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create backlog item
  app.post('/api/backlog', authenticateToken, async (req, res) => {
    try {
      const { name, description, portfolio_id, initiative_manager, priority, start_date, end_date, space_id } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const result = await dbRun(
        `INSERT INTO backlog_items (name, description, portfolio_id, initiative_manager, priority, start_date, end_date, space_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), description || null, portfolio_id || null, initiative_manager || null, priority || 'medium', start_date || null, end_date || null, space_id || null, req.user.userId]
      );

      // Log to audit
      await dbRun(
        `INSERT INTO audit_log (action, table_name, record_id, user_id, user_email, new_values, description, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['CREATE', 'backlog_items', result.lastID, req.user.userId, req.user.email, JSON.stringify({ name }), `Created backlog item: ${name}`, req.ip]
      );

      const newItem = await dbGet('SELECT * FROM backlog_items WHERE id = ?', [result.lastID]);
      res.status(201).json(newItem);
    } catch (err) {
      console.error('Create backlog item error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update backlog item
  app.put('/api/backlog/:id', authenticateToken, async (req, res) => {
    try {
      const { name, description, portfolio_id, initiative_manager, priority, start_date, end_date, space_id } = req.body;
      const { id } = req.params;

      const existing = await dbGet('SELECT * FROM backlog_items WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Backlog item not found' });
      }

      if (name !== undefined && (!name || !name.trim())) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }

      await dbRun(
        `UPDATE backlog_items SET
           name = COALESCE(?, name),
           description = ?,
           portfolio_id = ?,
           initiative_manager = ?,
           priority = COALESCE(?, priority),
           start_date = ?,
           end_date = ?,
           space_id = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name?.trim(), description, portfolio_id, initiative_manager, priority, start_date, end_date, space_id, id]
      );

      const updated = await dbGet('SELECT * FROM backlog_items WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) {
      console.error('Update backlog item error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete backlog item
  app.delete('/api/backlog/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await dbGet('SELECT * FROM backlog_items WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Backlog item not found' });
      }

      await dbRun('DELETE FROM backlog_items WHERE id = ?', [id]);

      // Log to audit
      await dbRun(
        `INSERT INTO audit_log (action, table_name, record_id, user_id, user_email, old_values, description, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['DELETE', 'backlog_items', id, req.user.userId, req.user.email, JSON.stringify({ name: existing.name }), `Deleted backlog item: ${existing.name}`, req.ip]
      );

      res.json({ message: 'Backlog item deleted successfully' });
    } catch (err) {
      console.error('Delete backlog item error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Promote backlog item to project (returns the backlog data for ProjectSetup to use)
  app.post('/api/backlog/:id/promote', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      const item = await dbGet(`
        SELECT b.*, p.name as portfolio_name
        FROM backlog_items b
        LEFT JOIN portfolios p ON b.portfolio_id = p.id
        WHERE b.id = ?
      `, [id]);

      if (!item) {
        return res.status(404).json({ error: 'Backlog item not found' });
      }

      // Return the backlog item data for the frontend to use in ProjectSetup
      // The frontend will create the project and then delete the backlog item
      res.json({
        ...item,
        message: 'Ready to promote - use this data to create project, then call DELETE /api/backlog/:id'
      });
    } catch (err) {
      console.error('Promote backlog item error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== PROJECTS =====
  app.get('/api/projects', async (req, res) => {
    try {
      const { portfolio_id } = req.query;
      let query = `
        SELECT p.*,
               po.name as portfolio_name,
               po.color as portfolio_color,
               (SELECT COUNT(*) FROM project_links pl WHERE pl.project_id = p.id) as link_count
        FROM projects p
        LEFT JOIN portfolios po ON p.portfolio_id = po.id`;
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

      // Validate required dates
      if (!start_date) {
        return res.status(400).json({ error: 'Start date is required' });
      }
      if (!end_date) {
        return res.status(400).json({ error: 'End date is required' });
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

      if (!oldProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Only validate initiative managers if they're being changed from the current value
      if (initiative_manager && initiative_manager.trim() && initiative_manager !== oldProject.initiative_manager) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [initiative_manager.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Primary initiative manager "${initiative_manager}" is not a registered user` });
        }
      }
      if (secondary_pm && secondary_pm.trim() && secondary_pm !== oldProject.secondary_pm) {
        const user = await dbGet('SELECT id FROM users WHERE name = ?', [secondary_pm.trim()]);
        if (!user) {
          return res.status(400).json({ error: `Secondary initiative manager "${secondary_pm}" is not a registered user` });
        }
      }

      await dbRun(
        'UPDATE projects SET name = ?, description = ?, initiative_manager = ?, secondary_pm = ?, start_date = ?, end_date = ?, portfolio_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
      logger.error('PROJECT', `Failed to update project ${req.params.id}: ${err.message}`);
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

  // ===== PROJECT DEPENDENCIES =====
  // Get all dependencies for a project (with RAG status of dependent projects)
  app.get('/api/projects/:projectId/dependencies', async (req, res) => {
    try {
      const dependencies = await dbAll(`
        SELECT
          pd.id,
          pd.depends_on_project_id,
          p.name as project_name,
          p.description as project_description,
          p.portfolio_id,
          pf.name as portfolio_name,
          pf.color as portfolio_color
        FROM project_dependencies pd
        JOIN projects p ON pd.depends_on_project_id = p.id
        LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
        WHERE pd.project_id = ?
        ORDER BY p.name
      `, [req.params.projectId]);

      // Calculate RAG status for each dependent project
      const dependenciesWithStatus = await Promise.all(dependencies.map(async (dep) => {
        // Get the latest period for each metric in the dependent project
        const metrics = await dbAll(`
          SELECT
            m.id,
            m.name,
            m.amber_tolerance,
            m.red_tolerance,
            mp.expected,
            mp.complete,
            mp.reporting_date
          FROM metrics m
          LEFT JOIN metric_periods mp ON m.id = mp.metric_id
          WHERE m.project_id = ?
          AND mp.reporting_date <= date('now')
          ORDER BY mp.reporting_date DESC
        `, [dep.depends_on_project_id]);

        // Get unique metrics with their latest period
        const latestByMetric = {};
        for (const m of metrics) {
          if (!latestByMetric[m.id]) {
            latestByMetric[m.id] = m;
          }
        }

        // Calculate overall RAG - worst status wins
        let overallStatus = 'green';
        for (const metric of Object.values(latestByMetric)) {
          if (metric.expected > 0) {
            const variance = ((metric.expected - metric.complete) / metric.expected) * 100;
            if (variance >= metric.red_tolerance) {
              overallStatus = 'red';
              break;
            } else if (variance >= metric.amber_tolerance && overallStatus !== 'red') {
              overallStatus = 'amber';
            }
          }
        }

        return {
          ...dep,
          rag_status: overallStatus,
          metric_count: Object.keys(latestByMetric).length
        };
      }));

      res.json(dependenciesWithStatus);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a dependency to a project
  app.post('/api/projects/:projectId/dependencies', authenticateToken, async (req, res) => {
    try {
      // Check if user can edit this project (PM or higher)
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to add dependencies to this project' });
      }

      const { depends_on_project_id } = req.body;

      if (!depends_on_project_id) {
        return res.status(400).json({ error: 'depends_on_project_id is required' });
      }

      // Prevent self-dependency
      if (parseInt(depends_on_project_id) === parseInt(req.params.projectId)) {
        return res.status(400).json({ error: 'A project cannot depend on itself' });
      }

      // Check if the target project exists
      const targetProject = await dbGet('SELECT id, name FROM projects WHERE id = ?', [depends_on_project_id]);
      if (!targetProject) {
        return res.status(404).json({ error: 'Target project not found' });
      }

      const result = await dbRun(
        'INSERT INTO project_dependencies (project_id, depends_on_project_id, created_by) VALUES (?, ?, ?)',
        [req.params.projectId, depends_on_project_id, req.user.userId]
      );

      await logAudit(req.user, 'CREATE', 'project_dependencies', result.lastID,
        null,
        { project_id: req.params.projectId, depends_on_project_id },
        `Added dependency on project "${targetProject.name}"`,
        req.ip
      );

      res.json({ success: true, id: result.lastID });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'This dependency already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Remove a dependency from a project
  app.delete('/api/projects/:projectId/dependencies/:dependencyId', authenticateToken, async (req, res) => {
    try {
      const dependency = await dbGet(
        'SELECT pd.*, p.name as target_project_name FROM project_dependencies pd JOIN projects p ON pd.depends_on_project_id = p.id WHERE pd.id = ? AND pd.project_id = ?',
        [req.params.dependencyId, req.params.projectId]
      );

      if (!dependency) {
        return res.status(404).json({ error: 'Dependency not found' });
      }

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to remove dependencies from this project' });
      }

      await dbRun('DELETE FROM project_dependencies WHERE id = ?', [req.params.dependencyId]);

      await logAudit(req.user, 'DELETE', 'project_dependencies', req.params.dependencyId,
        { project_id: req.params.projectId, depends_on_project_id: dependency.depends_on_project_id },
        null,
        `Removed dependency on project "${dependency.target_project_name}"`,
        req.ip
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get ALL project dependencies (for dependency graph visualization)
  app.get('/api/dependencies/all', async (req, res) => {
    try {
      const dependencies = await dbAll(`
        SELECT
          pd.id,
          pd.project_id,
          pd.depends_on_project_id,
          p1.name as project_name,
          p1.portfolio_id as project_portfolio_id,
          pf1.name as project_portfolio_name,
          pf1.color as project_portfolio_color,
          p2.name as depends_on_name,
          p2.portfolio_id as depends_on_portfolio_id,
          pf2.name as depends_on_portfolio_name,
          pf2.color as depends_on_portfolio_color
        FROM project_dependencies pd
        JOIN projects p1 ON pd.project_id = p1.id
        JOIN projects p2 ON pd.depends_on_project_id = p2.id
        LEFT JOIN portfolios pf1 ON p1.portfolio_id = pf1.id
        LEFT JOIN portfolios pf2 ON p2.portfolio_id = pf2.id
        ORDER BY p1.name, p2.name
      `);

      // Also get all projects to include ones without dependencies
      const allProjects = await dbAll(`
        SELECT
          p.id,
          p.name,
          p.portfolio_id,
          pf.name as portfolio_name,
          pf.color as portfolio_color
        FROM projects p
        LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
        ORDER BY p.name
      `);

      res.json({ dependencies, projects: allProjects });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== METRICS =====
  // (Route moved below to include ORDER BY display_order and owner_name join)

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

      // Invalidate cache for this project
      invalidateProjectCache(req.params.projectId);

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
      const { name, description, amber_tolerance, red_tolerance, final_target, progression_type, metric_type, start_date, end_date, recalculate_expected, show_in_portfolio_review, is_archived, has_dimensions } = req.body;

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
      if (show_in_portfolio_review !== undefined) {
        updates.push('show_in_portfolio_review = ?');
        values.push(show_in_portfolio_review ? 1 : 0);
        oldValues.show_in_portfolio_review = metric.show_in_portfolio_review;
        newValues.show_in_portfolio_review = show_in_portfolio_review ? 1 : 0;
      }
      if (is_archived !== undefined) {
        updates.push('is_archived = ?');
        values.push(is_archived ? 1 : 0);
        oldValues.is_archived = metric.is_archived;
        newValues.is_archived = is_archived ? 1 : 0;
      }
      if (has_dimensions !== undefined) {
        updates.push('has_dimensions = ?');
        values.push(has_dimensions ? 1 : 0);
        oldValues.has_dimensions = metric.has_dimensions;
        newValues.has_dimensions = has_dimensions ? 1 : 0;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
  
      values.push(req.params.id);
      await dbRun(`UPDATE metrics SET ${updates.join(', ')} WHERE id = ?`, values);

      // If final_target changed, update targets and optionally recalculate expected values
      // recalculate_expected can be: 'all' or 'future'
      // from_period_index: which period index to start updating from (0 = all)
      const from_period_index = req.body.from_period_index || 0;

      // Recalculate expected values when progression_type changes OR when explicitly requested
      const shouldRecalculate = (progression_type !== undefined && progression_type !== metric.progression_type) ||
                                 (final_target !== undefined && recalculate_expected);

      if (shouldRecalculate) {
        const updatedMetric = await dbGet('SELECT * FROM metrics WHERE id = ?', [req.params.id]);
        const periods = await dbAll(
          'SELECT id, reporting_date, expected FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date ASC',
          [req.params.id]
        );

        const totalPeriods = periods.length;

        // Get the base expected value (from period before the edited one, or 0 if editing first period)
        const baseExpected = from_period_index > 0 ? periods[from_period_index - 1].expected : 0;
        const remainingPeriods = totalPeriods - from_period_index;
        // The amount we need to add from base to reach the new target
        const deltaToTarget = updatedMetric.final_target - baseExpected;

        for (let i = 0; i < periods.length; i++) {
          // Only update periods from the edited period onwards
          if (i < from_period_index) {
            continue;
          }

          // Update the target for this period and all subsequent periods
          await dbRun(
            'UPDATE metric_periods SET target = ? WHERE id = ?',
            [updatedMetric.final_target, periods[i].id]
          );

          // For progression_type change or 'all' mode: recalculate all expected values
          // For 'future' mode: recalculate expected from current base to new target
          const progressionTypeChanged = progression_type !== undefined && progression_type !== metric.progression_type;

          if (progressionTypeChanged || recalculate_expected === 'all') {
            // Recalculate expected based on position in full progression curve
            const expected = calculateExpectedValue(
              updatedMetric.progression_type,
              updatedMetric.final_target,
              i + 1,
              totalPeriods
            );
            await dbRun(
              'UPDATE metric_periods SET expected = ? WHERE id = ?',
              [expected, periods[i].id]
            );
          } else if (recalculate_expected === 'future') {
            // Recalculate expected from the base expected value to the new target
            // Uses linear interpolation from base to target over remaining periods
            const periodInRemaining = i - from_period_index + 1;
            const ratio = periodInRemaining / remainingPeriods;
            const expected = Math.round(baseExpected + (deltaToTarget * ratio));
            await dbRun(
              'UPDATE metric_periods SET expected = ? WHERE id = ?',
              [expected, periods[i].id]
            );
          }
        }
      }

      await logAudit(req.user, 'UPDATE', 'metrics', req.params.id,
        oldValues,
        newValues,
        `Updated metric "${metric.name}"`,
        req.ip
      );

      // Invalidate cache for this project
      invalidateProjectCache(metric.project_id);

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

      // Invalidate cache for this project
      invalidateProjectCache(metric.project_id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== REORDER METRICS FOR A PROJECT =====
  app.put('/api/projects/:projectId/metrics/reorder', authenticateToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { metricOrder } = req.body; // Array of metric IDs in desired order

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, projectId))) {
        return res.status(403).json({ error: 'You do not have permission to reorder metrics' });
      }

      // Validate metricOrder is an array
      if (!Array.isArray(metricOrder)) {
        return res.status(400).json({ error: 'metricOrder must be an array of metric IDs' });
      }

      // Update display_order for each metric
      for (let i = 0; i < metricOrder.length; i++) {
        await dbRun(
          'UPDATE metrics SET display_order = ? WHERE id = ? AND project_id = ?',
          [i, metricOrder[i], projectId]
        );
      }

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
          m.show_in_portfolio_review,
          m.is_archived,
          u.name as owner_name
        FROM metrics m
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE m.project_id = ?
        ORDER BY COALESCE(m.display_order, 999), m.name
      `, [req.params.projectId]);
  
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== PROJECT DATA (for grid view) =====
  app.get('/api/projects/:projectId/data', async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const cacheKey = cacheKeys.projectData(projectId);

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for project data: ${projectId}`);
        return res.json(cached);
      }

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
          mp.updated_at,
          m.id as metric_id,
          m.amber_tolerance,
          m.red_tolerance,
          m.start_date,
          m.end_date,
          m.frequency,
          m.progression_type,
          m.metric_type,
          m.has_dimensions,
          p.name as initiative,
          u.name as owner,
          p.initiative_manager
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        JOIN projects p ON m.project_id = p.id
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE m.project_id = ?
        ORDER BY mp.reporting_date
      `, [projectId]);

      // For metrics with dimensions, fetch dimension values
      const metricsWithDimensions = [...new Set(data.filter(d => d.has_dimensions).map(d => d.metric_id))];

      if (metricsWithDimensions.length > 0) {
        // First, get all dimension definitions for these metrics
        const allDimensions = await dbAll(`
          SELECT id, metric_id, name, display_order
          FROM metric_dimensions
          WHERE metric_id IN (${metricsWithDimensions.join(',')})
          ORDER BY display_order, id
        `);

        // Group dimensions by metric_id for easy lookup
        const dimensionsByMetric = {};
        for (const dim of allDimensions) {
          if (!dimensionsByMetric[dim.metric_id]) {
            dimensionsByMetric[dim.metric_id] = [];
          }
          dimensionsByMetric[dim.metric_id].push(dim);
        }

        // Get all stored dimension values for periods in this project
        const periodIds = data.map(d => d.id);
        const dimensionValues = await dbAll(`
          SELECT mpdv.period_id, mpdv.dimension_id, mpdv.value, md.name, md.metric_id
          FROM metric_period_dimension_values mpdv
          JOIN metric_dimensions md ON mpdv.dimension_id = md.id
          WHERE mpdv.period_id IN (${periodIds.join(',')})
          ORDER BY md.display_order, md.id
        `);

        // Group stored dimension values by period
        const valuesByPeriod = {};
        for (const dv of dimensionValues) {
          if (!valuesByPeriod[dv.period_id]) {
            valuesByPeriod[dv.period_id] = {};
          }
          valuesByPeriod[dv.period_id][dv.dimension_id] = dv.value;
        }

        // Attach dimension values to each period (include all dimensions with default 0)
        for (const period of data) {
          if (period.has_dimensions) {
            const metricDimensions = dimensionsByMetric[period.metric_id] || [];
            const storedValues = valuesByPeriod[period.id] || {};

            // Build dimension_values array with all dimensions, using stored value or 0
            period.dimension_values = metricDimensions.map(dim => ({
              dimension_id: dim.id,
              name: dim.name,
              value: storedValues[dim.id] !== undefined ? storedValues[dim.id] : 0
            }));
          }
        }
      }

      // Cache for 60 seconds (default TTL)
      cache.set(cacheKey, data);
      logger.debug(`Cache miss for project data: ${projectId}, cached result`);

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ===== METRIC PERIODS =====
  app.get('/api/metrics/:metricId/periods', async (req, res) => {
    try {
      const metricId = req.params.metricId;

      // Check if metric has dimensions enabled
      const metric = await dbGet('SELECT has_dimensions FROM metrics WHERE id = ?', [metricId]);

      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [metricId]);

      // If metric has dimensions, fetch dimension values for all periods
      if (metric?.has_dimensions) {
        const dimensions = await dbAll(
          'SELECT * FROM metric_dimensions WHERE metric_id = ? ORDER BY display_order, id',
          [metricId]
        );

        // Get all stored dimension values for this metric's periods
        const periodIds = periods.map(p => p.id);
        const valuesByPeriod = {};

        if (periodIds.length > 0) {
          const dimensionValues = await dbAll(`
            SELECT mpdv.period_id, mpdv.dimension_id, mpdv.value
            FROM metric_period_dimension_values mpdv
            JOIN metric_dimensions md ON mpdv.dimension_id = md.id
            WHERE mpdv.period_id IN (${periodIds.join(',')})
          `);

          // Group stored dimension values by period
          for (const dv of dimensionValues) {
            if (!valuesByPeriod[dv.period_id]) {
              valuesByPeriod[dv.period_id] = {};
            }
            valuesByPeriod[dv.period_id][dv.dimension_id] = dv.value;
          }
        }

        // Attach dimension values to each period (include all dimensions with default 0)
        for (const period of periods) {
          const storedValues = valuesByPeriod[period.id] || {};
          period.dimension_values = dimensions.map(dim => ({
            dimension_id: dim.id,
            name: dim.name,
            value: storedValues[dim.id] !== undefined ? storedValues[dim.id] : 0
          }));
        }

        // Also return dimensions metadata
        return res.json({ periods, dimensions, has_dimensions: true });
      }

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

      // Invalidate cache for this project
      invalidateProjectCache(metric.project_id);

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
  
      const { complete, expected, target, reporting_date } = req.body;

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

      if (reporting_date !== undefined) {
        updates.push('reporting_date = ?');
        params.push(reporting_date);
        oldValues.reporting_date = periodData.reporting_date;
        newValues.reporting_date = reporting_date;
      }
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

        // Invalidate cache for this project
        invalidateProjectCache(periodData.project_id);
      }

      res.json({ success: true, isHistoricEdit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/metric-periods/:id', authenticateToken, async (req, res) => {
    try {
      // Get the project_id for this period
      const patchPeriodData = await dbGet(`
        SELECT mp.*, m.project_id, m.name as metric_name
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [req.params.id]);
      if (!patchPeriodData) {
        return res.status(404).json({ error: 'Period not found' });
      }

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, patchPeriodData.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this data' });
      }

      const { complete, commentary } = req.body;

      // Check if this is a historic edit of completion values (period end date has passed)
      const periodEndDate = new Date(patchPeriodData.reporting_date);
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
          ? `⚠️ HISTORIC EDIT: Updated complete value for metric "${patchPeriodData.metric_name}" on ${patchPeriodData.reporting_date} (period ended ${patchPeriodData.reporting_date})`
          : `Updated complete value for metric "${patchPeriodData.metric_name}" on ${patchPeriodData.reporting_date}`;

        await logAudit(req.user, 'UPDATE', 'metric_periods', req.params.id,
          { complete: patchPeriodData.complete },
          { complete },
          description,
          req.ip
        );
      }

      // Handle commentary updates
      if (commentary !== undefined) {
        await dbRun('UPDATE metric_periods SET commentary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [commentary, req.params.id]);

        // Get project name for description
        const project = await dbGet('SELECT p.name FROM projects p JOIN metrics m ON p.id = m.project_id WHERE m.id = ?', [patchPeriodData.metric_id]);
        const projectName = project?.name || 'Unknown';

        await logAudit(req.user, 'UPDATE', 'metric_periods', req.params.id,
          { commentary: patchPeriodData.commentary },
          { commentary },
          `Updated metric period for Project: ${projectName}, Metric: ${patchPeriodData.metric_name}, Period: ${patchPeriodData.reporting_date}`,
          req.ip
        );
      }

      // Invalidate cache for this project
      invalidateProjectCache(patchPeriodData.project_id);

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

      // Invalidate cache for this project
      invalidateProjectCache(periodData.project_id);

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting metric period:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== METRIC DIMENSIONS =====

  // Get all dimensions for a metric
  app.get('/api/metrics/:metricId/dimensions', async (req, res) => {
    try {
      const dimensions = await dbAll(
        'SELECT * FROM metric_dimensions WHERE metric_id = ? ORDER BY display_order, id',
        [req.params.metricId]
      );
      res.json(dimensions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new dimension for a metric
  app.post('/api/metrics/:metricId/dimensions', authenticateToken, async (req, res) => {
    try {
      const { name, display_order } = req.body;
      const metricId = req.params.metricId;

      // Get metric and check permissions
      const metric = await dbGet('SELECT project_id, name as metric_name FROM metrics WHERE id = ?', [metricId]);
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }

      if (!(await canEditProject(req.user.userId, metric.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this metric' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Dimension name is required' });
      }

      // Enforce maximum of 4 dimensions per metric for visual clarity
      const existingCount = await dbGet(
        'SELECT COUNT(*) as count FROM metric_dimensions WHERE metric_id = ?',
        [metricId]
      );
      if (existingCount.count >= 4) {
        return res.status(400).json({ error: 'Maximum of 4 dimensions per metric allowed' });
      }

      const result = await dbRun(
        'INSERT INTO metric_dimensions (metric_id, name, display_order) VALUES (?, ?, ?)',
        [metricId, name.trim(), display_order || 0]
      );

      // Enable dimensions on the metric if not already
      await dbRun('UPDATE metrics SET has_dimensions = 1 WHERE id = ?', [metricId]);

      await logAudit(req.user, 'CREATE', 'metric_dimensions', result.lastID, null,
        { metric_id: metricId, name: name.trim() },
        `Created dimension "${name}" for metric "${metric.metric_name}"`,
        req.ip
      );

      invalidateProjectCache(metric.project_id);

      res.json({ id: result.lastID, name: name.trim(), display_order: display_order || 0 });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A dimension with this name already exists for this metric' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Update a dimension
  app.put('/api/metrics/:metricId/dimensions/:id', authenticateToken, async (req, res) => {
    try {
      const { name, display_order } = req.body;
      const dimensionId = req.params.id;

      // Get dimension and metric info
      const dimension = await dbGet(`
        SELECT md.*, m.project_id, m.name as metric_name
        FROM metric_dimensions md
        JOIN metrics m ON md.metric_id = m.id
        WHERE md.id = ?
      `, [dimensionId]);

      if (!dimension) {
        return res.status(404).json({ error: 'Dimension not found' });
      }

      if (!(await canEditProject(req.user.userId, dimension.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this metric' });
      }

      const updates = [];
      const params = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
      if (display_order !== undefined) { updates.push('display_order = ?'); params.push(display_order); }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      params.push(dimensionId);
      await dbRun(`UPDATE metric_dimensions SET ${updates.join(', ')} WHERE id = ?`, params);

      await logAudit(req.user, 'UPDATE', 'metric_dimensions', dimensionId,
        { name: dimension.name, display_order: dimension.display_order },
        { name, display_order },
        `Updated dimension "${dimension.name}" for metric "${dimension.metric_name}"`,
        req.ip
      );

      invalidateProjectCache(dimension.project_id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a dimension
  app.delete('/api/metrics/:metricId/dimensions/:id', authenticateToken, async (req, res) => {
    try {
      const dimensionId = req.params.id;

      // Get dimension info
      const dimension = await dbGet(`
        SELECT md.*, m.project_id, m.name as metric_name
        FROM metric_dimensions md
        JOIN metrics m ON md.metric_id = m.id
        WHERE md.id = ?
      `, [dimensionId]);

      if (!dimension) {
        return res.status(404).json({ error: 'Dimension not found' });
      }

      if (!(await canEditProject(req.user.userId, dimension.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this metric' });
      }

      // Delete dimension (cascade will remove dimension values)
      await dbRun('DELETE FROM metric_dimensions WHERE id = ?', [dimensionId]);

      // Check if metric still has any dimensions
      const remainingCount = await dbGet(
        'SELECT COUNT(*) as count FROM metric_dimensions WHERE metric_id = ?',
        [dimension.metric_id]
      );
      if (remainingCount.count === 0) {
        await dbRun('UPDATE metrics SET has_dimensions = 0 WHERE id = ?', [dimension.metric_id]);
      }

      await logAudit(req.user, 'DELETE', 'metric_dimensions', dimensionId,
        { name: dimension.name },
        null,
        `Deleted dimension "${dimension.name}" from metric "${dimension.metric_name}"`,
        req.ip
      );

      invalidateProjectCache(dimension.project_id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update dimension values for a period (bulk update)
  app.put('/api/metric-periods/:periodId/dimensions', authenticateToken, async (req, res) => {
    try {
      const periodId = req.params.periodId;
      const { dimensions } = req.body; // [{ dimension_id, value }]

      if (!Array.isArray(dimensions)) {
        return res.status(400).json({ error: 'dimensions must be an array' });
      }

      // Get period and metric info
      const period = await dbGet(`
        SELECT mp.*, m.project_id, m.name as metric_name, m.has_dimensions
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        WHERE mp.id = ?
      `, [periodId]);

      if (!period) {
        return res.status(404).json({ error: 'Period not found' });
      }

      if (!(await canEditProject(req.user.userId, period.project_id))) {
        return res.status(403).json({ error: 'You do not have permission to edit this data' });
      }

      // Upsert each dimension value
      for (const dim of dimensions) {
        if (dim.dimension_id && dim.value !== undefined) {
          await dbRun(`
            INSERT INTO metric_period_dimension_values (period_id, dimension_id, value)
            VALUES (?, ?, ?)
            ON CONFLICT(period_id, dimension_id) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
          `, [periodId, dim.dimension_id, dim.value, dim.value]);
        }
      }

      // Calculate total and update the period's complete value
      const totalResult = await dbGet(`
        SELECT SUM(value) as total
        FROM metric_period_dimension_values
        WHERE period_id = ?
      `, [periodId]);

      const total = totalResult?.total || 0;
      await dbRun('UPDATE metric_periods SET complete = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [total, periodId]);

      invalidateProjectCache(period.project_id);

      res.json({ success: true, total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get dimension values for a period
  app.get('/api/metric-periods/:periodId/dimensions', async (req, res) => {
    try {
      const values = await dbAll(`
        SELECT mpdv.*, md.name, md.display_order
        FROM metric_period_dimension_values mpdv
        JOIN metric_dimensions md ON mpdv.dimension_id = md.id
        WHERE mpdv.period_id = ?
        ORDER BY md.display_order, md.id
      `, [req.params.periodId]);
      res.json(values);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== COMMENTS (for periods) =====

  // Get all comments grouped by user for clarity scoring (admin only)
  app.get('/api/comments/by-user', authenticateToken, async (req, res) => {
    try {
      // Check if user is admin
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can view clarity rankings' });
      }

      const comments = await dbAll(`
        SELECT
          c.id,
          c.comment_text,
          c.created_by,
          u.name as user_name,
          u.email as user_email
        FROM comments c
        JOIN users u ON c.created_by = u.id
        WHERE c.comment_text IS NOT NULL AND c.comment_text != ''
      `);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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
          c.parent_comment_id,
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
        ORDER BY COALESCE(c.parent_comment_id, c.id) DESC, c.parent_comment_id IS NULL DESC, c.created_at ASC
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
        ORDER BY COALESCE(c.parent_comment_id, c.id) ASC, c.parent_comment_id IS NULL DESC, c.created_at ASC
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

      const { comment_text, parent_comment_id } = req.body;
      const result = await dbRun(
        'INSERT INTO comments (period_id, comment_text, created_by, parent_comment_id) VALUES (?, ?, ?, ?)',
        [req.params.periodId, comment_text, req.user.userId, parent_comment_id || null]
      );

      await logAudit(req.user, 'CREATE', 'comments', result.lastID, null,
        { period_id: req.params.periodId, comment_text, parent_comment_id: parent_comment_id || null },
        `Added ${parent_comment_id ? 'reply to comment ID ' + parent_comment_id : 'comment'} on period ID ${req.params.periodId}`,
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

  // ===== PROJECT COMMENTS =====

  // Get project comments (threaded)
  app.get('/api/projects/:projectId/comments', async (req, res) => {
    try {
      const comments = await dbAll(`
        SELECT pc.*, u.name as creator_name
        FROM project_comments pc
        LEFT JOIN users u ON pc.created_by = u.id
        WHERE pc.project_id = ?
        ORDER BY COALESCE(pc.parent_comment_id, pc.id) ASC, pc.parent_comment_id IS NULL DESC, pc.created_at ASC
      `, [req.params.projectId]);

      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add project comment (supports threading via parent_comment_id)
  app.post('/api/projects/:projectId/comments', authenticateToken, async (req, res) => {
    try {
      const { comment_text, parent_comment_id } = req.body;

      if (!comment_text || !comment_text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
      }

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to add comments to this project' });
      }

      // Validate parent_comment_id if provided
      if (parent_comment_id) {
        const parentComment = await dbGet(
          'SELECT id FROM project_comments WHERE id = ? AND project_id = ?',
          [parent_comment_id, req.params.projectId]
        );
        if (!parentComment) {
          return res.status(400).json({ error: 'Parent comment not found' });
        }
      }

      const result = await dbRun(`
        INSERT INTO project_comments (project_id, comment_text, created_by, parent_comment_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [req.params.projectId, comment_text, req.user.userId, parent_comment_id || null]);

      const newComment = await dbGet(`
        SELECT pc.*, u.name as creator_name
        FROM project_comments pc
        LEFT JOIN users u ON pc.created_by = u.id
        WHERE pc.id = ?
      `, [result.lastID]);

      await logAudit(req.user, 'INSERT', 'project_comments', result.lastID,
        null,
        newComment,
        `Added ${parent_comment_id ? 'reply to comment ID ' + parent_comment_id : 'comment'} on project ID ${req.params.projectId}`,
        req.ip
      );

      res.json(newComment);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update project comment
  app.put('/api/projects/:projectId/comments/:id', authenticateToken, async (req, res) => {
    try {
      const { comment_text } = req.body;

      const existingComment = await dbGet('SELECT * FROM project_comments WHERE id = ?', [req.params.id]);
      if (!existingComment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to edit this comment' });
      }

      await dbRun(`
        UPDATE project_comments
        SET comment_text = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [comment_text, req.params.id]);

      const updated = await dbGet(`
        SELECT pc.*, u.name as creator_name
        FROM project_comments pc
        LEFT JOIN users u ON pc.created_by = u.id
        WHERE pc.id = ?
      `, [req.params.id]);

      await logAudit(req.user, 'UPDATE', 'project_comments', req.params.id,
        existingComment,
        updated,
        `Updated project comment ${req.params.id}`,
        req.ip
      );

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete project comment
  app.delete('/api/projects/:projectId/comments/:id', authenticateToken, async (req, res) => {
    try {
      const comment = await dbGet('SELECT * FROM project_comments WHERE id = ?', [req.params.id]);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Check if user can edit this project
      if (!(await canEditProject(req.user.userId, req.params.projectId))) {
        return res.status(403).json({ error: 'You do not have permission to delete this comment' });
      }

      await dbRun('DELETE FROM project_comments WHERE id = ?', [req.params.id]);

      await logAudit(req.user, 'DELETE', 'project_comments', req.params.id,
        comment,
        null,
        `Deleted project comment ${req.params.id}`,
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
  
      const users = await dbAll('SELECT id, email, name, role, is_system_admin, created_at FROM users ORDER BY created_at DESC');
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update user details (Admin only)
  app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Only admins can update user details' });
      }

      const { name, email } = req.body;
      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if new name is taken by another user
      if (name && name !== targetUser.name) {
        const existingName = await dbGet('SELECT id FROM users WHERE name = ? AND id != ?', [name, req.params.id]);
        if (existingName) {
          return res.status(400).json({ error: 'This name is already taken by another user' });
        }
      }

      // Check if new email is taken by another user
      if (email && email !== targetUser.email) {
        const existingEmail = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.params.id]);
        if (existingEmail) {
          return res.status(400).json({ error: 'This email is already taken by another user' });
        }
      }

      const updates = [];
      const params = [];
      const oldValues = {};
      const newValues = {};

      if (name && name !== targetUser.name) {
        updates.push('name = ?');
        params.push(name);
        oldValues.name = targetUser.name;
        newValues.name = name;
      }

      if (email && email !== targetUser.email) {
        updates.push('email = ?');
        params.push(email);
        oldValues.email = targetUser.email;
        newValues.email = email;
      }

      if (updates.length === 0) {
        return res.json({ success: true, message: 'No changes made' });
      }

      params.push(req.params.id);
      await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

      const changes = Object.keys(newValues).map(k => `${k}: ${oldValues[k]} → ${newValues[k]}`).join(', ');
      await logAudit(req.user, 'UPDATE', 'users', req.params.id,
        oldValues,
        newValues,
        `Updated user ${targetUser.email}: ${changes}`,
        req.ip
      );

      res.json({ success: true });
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
      if (!['admin', 'pm'].includes(role)) {
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
  
  // Admin reset password for another user (Admin only)
  app.post('/api/users/:id/reset-password', authenticateToken, async (req, res) => {
    try {
      const adminUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(adminUser)) {
        return res.status(403).json({ error: 'Only admins can reset user passwords' });
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Update password
      await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.params.id]);

      // Log audit entry
      await logAudit(
        req.user,
        'UPDATE',
        'users',
        req.params.id,
        { action: 'password_reset_by_admin' },
        { action: 'password_reset' },
        `Admin ${adminUser.email} reset password for user ${targetUser.email}`,
        req.ip
      );

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      console.error('Admin password reset error:', err);
      res.status(500).json({ error: 'Failed to reset password' });
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

  // ===== SPACE ADMIN ASSIGNMENTS =====
  // Get all space admin assignments (System Admin only)
  app.get('/api/space-admin-assignments', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const assignments = await dbAll(`
        SELECT sa.*, u.name as user_name, u.email as user_email, s.name as space_name
        FROM space_admin_assignments sa
        JOIN users u ON sa.user_id = u.id
        JOIN spaces s ON sa.space_id = s.id
        ORDER BY u.name, s.name
      `);

      res.json(assignments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get space admin assignments for a specific user (System Admin only)
  app.get('/api/users/:userId/space-assignments', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const assignments = await dbAll(`
        SELECT sa.*, s.name as space_name, s.color as space_color
        FROM space_admin_assignments sa
        JOIN spaces s ON sa.space_id = s.id
        WHERE sa.user_id = ?
        ORDER BY s.display_order
      `, [req.params.userId]);

      res.json(assignments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get spaces available for admin assignment (System Admin only)
  app.get('/api/spaces-for-assignment', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const spaces = await dbAll('SELECT id, name FROM spaces ORDER BY display_order');
      res.json(spaces);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Assign admin to space (System Admin only)
  app.post('/api/space-admin-assignments', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const { user_id, space_id } = req.body;
      if (!user_id || !space_id) {
        return res.status(400).json({ error: 'user_id and space_id are required' });
      }

      // Check if target user is an admin
      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [user_id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.role !== 'admin') {
        return res.status(400).json({ error: 'Can only assign spaces to admin users' });
      }
      if (targetUser.is_system_admin === 1) {
        return res.status(400).json({ error: 'System admins already have access to all spaces' });
      }

      // Check if space exists
      const space = await dbGet('SELECT * FROM spaces WHERE id = ?', [space_id]);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }

      // Check if assignment already exists
      const existing = await dbGet(
        'SELECT id FROM space_admin_assignments WHERE user_id = ? AND space_id = ?',
        [user_id, space_id]
      );
      if (existing) {
        return res.status(400).json({ error: 'Assignment already exists' });
      }

      await dbRun(
        'INSERT INTO space_admin_assignments (user_id, space_id, created_by) VALUES (?, ?, ?)',
        [user_id, space_id, req.user.userId]
      );

      await logAudit(req.user, 'CREATE', 'space_admin_assignments', null,
        null,
        { user_id, space_id },
        `Assigned ${targetUser.email} as admin for space "${space.name}"`,
        req.ip
      );

      res.status(201).json({
        success: true,
        message: `Assigned ${targetUser.email} to space "${space.name}"`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove admin from space (System Admin only)
  app.delete('/api/space-admin-assignments/:userId/:spaceId', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const { userId, spaceId } = req.params;

      // Check if assignment exists
      const assignment = await dbGet(
        'SELECT id FROM space_admin_assignments WHERE user_id = ? AND space_id = ?',
        [userId, spaceId]
      );
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      const space = await dbGet('SELECT * FROM spaces WHERE id = ?', [spaceId]);

      await dbRun(
        'DELETE FROM space_admin_assignments WHERE user_id = ? AND space_id = ?',
        [userId, spaceId]
      );

      await logAudit(req.user, 'DELETE', 'space_admin_assignments', null,
        { user_id: userId, space_id: spaceId },
        null,
        `Removed ${targetUser?.email || 'user'} as admin from space "${space?.name || 'unknown'}"`,
        req.ip
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get admin's accessible spaces (for current user)
  app.get('/api/my-admin-spaces', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);

      if (!isAdmin(user)) {
        return res.json([]);
      }

      if (isSystemAdmin(user)) {
        // System admins have access to all spaces
        const spaces = await dbAll('SELECT id, name FROM spaces ORDER BY display_order');
        res.json(spaces);
      } else {
        // Regular admins get assigned spaces only
        const spaces = await dbAll(`
          SELECT s.id, s.name
          FROM spaces s
          INNER JOIN space_admin_assignments sa ON s.id = sa.space_id
          WHERE sa.user_id = ?
          ORDER BY s.display_order
        `, [req.user.userId]);
        res.json(spaces);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update user to/from system admin (System Admin only)
  app.put('/api/users/:id/system-admin', authenticateToken, async (req, res) => {
    try {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isSystemAdmin(user)) {
        return res.status(403).json({ error: 'System admin access required' });
      }

      const { is_system_admin } = req.body;
      if (typeof is_system_admin !== 'boolean' && typeof is_system_admin !== 'number') {
        return res.status(400).json({ error: 'is_system_admin must be a boolean' });
      }

      // Prevent removing system admin from yourself
      if (parseInt(req.params.id) === req.user.userId && !is_system_admin) {
        return res.status(400).json({ error: 'You cannot remove system admin from yourself' });
      }

      const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // User must be an admin to become system admin
      if (is_system_admin && targetUser.role !== 'admin') {
        return res.status(400).json({ error: 'User must be an admin to become a system admin' });
      }

      const newValue = is_system_admin ? 1 : 0;
      await dbRun('UPDATE users SET is_system_admin = ? WHERE id = ?', [newValue, req.params.id]);

      // If promoting to system admin, remove space assignments (they now have all spaces)
      if (is_system_admin) {
        await dbRun('DELETE FROM space_admin_assignments WHERE user_id = ?', [req.params.id]);
      }

      await logAudit(req.user, 'UPDATE', 'users', req.params.id,
        { is_system_admin: targetUser.is_system_admin },
        { is_system_admin: newValue },
        `${is_system_admin ? 'Promoted' : 'Demoted'} ${targetUser.email} ${is_system_admin ? 'to' : 'from'} system admin`,
        req.ip
      );

      res.json({
        success: true,
        message: `${targetUser.email} is ${is_system_admin ? 'now a system admin' : 'no longer a system admin'}`
      });
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

      const { limit = 100, offset = 0, table_name, user_id, action, project_id, date } = req.query;

      let query = '';
      const params = [];

      // Build record IDs for project-based filtering
      let projectRecordIds = null;
      if (project_id) {
        // Get all metric IDs for this project
        const metrics = await dbAll('SELECT id FROM metrics WHERE project_id = ?', [parseInt(project_id)]);
        const metricIds = metrics.map(m => m.id);

        // Get all metric_period IDs for these metrics
        let periodIds = [];
        if (metricIds.length > 0) {
          const periods = await dbAll(
            `SELECT id FROM metric_periods WHERE metric_id IN (${metricIds.map(() => '?').join(',')})`,
            metricIds
          );
          periodIds = periods.map(p => p.id);
        }

        // Get all comment IDs for periods of this project
        let commentIds = [];
        if (periodIds.length > 0) {
          const comments = await dbAll(
            `SELECT id FROM comments WHERE period_id IN (${periodIds.map(() => '?').join(',')})`,
            periodIds
          );
          commentIds = comments.map(c => c.id);
        }

        // Get all project comment IDs for this project
        const projectComments = await dbAll('SELECT id FROM project_comments WHERE project_id = ?', [parseInt(project_id)]);
        const projectCommentIds = projectComments.map(c => c.id);

        projectRecordIds = {
          projects: [parseInt(project_id)],
          metrics: metricIds,
          metric_periods: periodIds,
          comments: commentIds,
          project_comments: projectCommentIds
        };
      }

      // Build the query based on filters
      if (project_id && !table_name) {
        // Filter by project across all tables
        const conditions = [];
        const allParams = [];

        // Projects table
        if (projectRecordIds.projects.length > 0) {
          conditions.push(`(table_name = 'projects' AND record_id IN (${projectRecordIds.projects.map(() => '?').join(',')}))`);
          allParams.push(...projectRecordIds.projects);
        }
        // Metrics table
        if (projectRecordIds.metrics.length > 0) {
          conditions.push(`(table_name = 'metrics' AND record_id IN (${projectRecordIds.metrics.map(() => '?').join(',')}))`);
          allParams.push(...projectRecordIds.metrics);
        }
        // Metric periods table
        if (projectRecordIds.metric_periods.length > 0) {
          conditions.push(`(table_name = 'metric_periods' AND record_id IN (${projectRecordIds.metric_periods.map(() => '?').join(',')}))`);
          allParams.push(...projectRecordIds.metric_periods);
        }
        // Comments table
        if (projectRecordIds.comments.length > 0) {
          conditions.push(`(table_name = 'comments' AND record_id IN (${projectRecordIds.comments.map(() => '?').join(',')}))`);
          allParams.push(...projectRecordIds.comments);
        }
        // Project comments table
        if (projectRecordIds.project_comments.length > 0) {
          conditions.push(`(table_name = 'project_comments' AND record_id IN (${projectRecordIds.project_comments.map(() => '?').join(',')}))`);
          allParams.push(...projectRecordIds.project_comments);
        }

        if (conditions.length === 0) {
          return res.json([]);
        }

        query = `SELECT *, created_at as timestamp FROM audit_log WHERE (${conditions.join(' OR ')})`;
        params.push(...allParams);

        if (user_id) {
          query += ' AND user_id = ?';
          params.push(parseInt(user_id));
        }
        if (action) {
          query += ' AND action = ?';
          params.push(action);
        }
        if (date) {
          query += ' AND DATE(created_at) = ?';
          params.push(date);
        }
      } else if (project_id && table_name) {
        // Filter by project AND specific table
        const recordIds = projectRecordIds[table_name] || [];
        if (recordIds.length === 0) {
          return res.json([]);
        }

        query = `SELECT *, created_at as timestamp FROM audit_log
                 WHERE table_name = ?
                 AND record_id IN (${recordIds.map(() => '?').join(',')})`;
        params.push(table_name, ...recordIds);

        if (user_id) {
          query += ' AND user_id = ?';
          params.push(parseInt(user_id));
        }
        if (action) {
          query += ' AND action = ?';
          params.push(action);
        }
        if (date) {
          query += ' AND DATE(created_at) = ?';
          params.push(date);
        }
      } else {
        // No project filter
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
        if (date) {
          query += ' AND DATE(created_at) = ?';
          params.push(date);
        }
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const logs = await dbAll(query, params);

      // Enrich entries with user info and context
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        let enrichedLog = { ...log };

        // Add user information if user_id exists but user_email is missing
        if (log.user_id && !log.user_email) {
          try {
            const userInfo = await dbGet('SELECT email, name FROM users WHERE id = ?', [log.user_id]);
            if (userInfo) {
              enrichedLog.user_email = userInfo.email;
              enrichedLog.user_name = userInfo.name;
            }
          } catch (e) {
            // User may have been deleted, ignore
          }
        }

        // Add metric/project context based on table
        if (log.table_name === 'metric_periods' && log.record_id) {
          try {
            const context = await dbGet(`
              SELECT m.name as metric_name, p.name as project_name, p.id as project_id
              FROM metric_periods mp
              JOIN metrics m ON mp.metric_id = m.id
              JOIN projects p ON m.project_id = p.id
              WHERE mp.id = ?
            `, [log.record_id]);
            if (context) {
              enrichedLog = { ...enrichedLog, metric_name: context.metric_name, project_name: context.project_name, project_id: context.project_id };
            }
          } catch (e) {
            // Period may have been deleted, ignore
          }
        } else if (log.table_name === 'metrics' && log.record_id) {
          try {
            const context = await dbGet(`
              SELECT m.name as metric_name, p.name as project_name, p.id as project_id
              FROM metrics m
              JOIN projects p ON m.project_id = p.id
              WHERE m.id = ?
            `, [log.record_id]);
            if (context) {
              enrichedLog = { ...enrichedLog, metric_name: context.metric_name, project_name: context.project_name, project_id: context.project_id };
            }
          } catch (e) {
            // Metric may have been deleted, ignore
          }
        } else if (log.table_name === 'projects' && log.record_id) {
          try {
            const context = await dbGet(`SELECT id as project_id, name as project_name FROM projects WHERE id = ?`, [log.record_id]);
            if (context) {
              enrichedLog = { ...enrichedLog, project_name: context.project_name, project_id: context.project_id };
            }
          } catch (e) {
            // Project may have been deleted, ignore
          }
        }

        return enrichedLog;
      }));

      res.json(enrichedLogs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== AUDIT LOG TIMELINE (Daily counts for visualization) =====
  app.get('/api/audit/timeline', authenticateToken, async (req, res) => {
    try {
      // Admin only
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { days = 14 } = req.query;
      const numDays = Math.min(parseInt(days) || 14, 90); // Cap at 90 days

      // Get daily counts using SQLite date functions
      const counts = await dbAll(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total
        FROM audit_log
        WHERE created_at >= DATE('now', '-' || ? || ' days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [numDays]);

      // Build array with all days (including zeros)
      const result = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = numDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayData = counts.find(c => c.date === dateStr);
        result.push({
          date: dateStr,
          total: dayData ? dayData.total : 0
        });
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== RECENT FIELD CHANGES (for highlighting recently modified fields) =====
  app.get('/api/recent-changes', authenticateToken, async (req, res) => {
    try {
      const { table_name, record_ids, hours = 24 } = req.query;

      if (!table_name) {
        return res.status(400).json({ error: 'table_name is required' });
      }

      // Parse record_ids - can be comma-separated or single value
      let ids = [];
      if (record_ids) {
        ids = record_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      // Calculate cutoff time
      const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
      const cutoffTime = hoursAgo.toISOString().replace('T', ' ').slice(0, 19);

      // Build query
      let query = `
        SELECT record_id, old_values, new_values, created_at
        FROM audit_log
        WHERE table_name = ?
          AND action = 'UPDATE'
          AND created_at >= ?
      `;
      let params = [table_name, cutoffTime];

      if (ids.length > 0) {
        query += ` AND record_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }

      query += ' ORDER BY created_at DESC';

      const changes = await dbAll(query, params);

      // Process changes to determine which fields actually changed
      const result = {};

      for (const change of changes) {
        const recordId = change.record_id;
        if (!result[recordId]) {
          result[recordId] = { fields: new Set(), updated_at: change.created_at };
        }

        try {
          const oldVals = change.old_values ? JSON.parse(change.old_values) : {};
          const newVals = change.new_values ? JSON.parse(change.new_values) : {};

          // Find fields that actually changed
          const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
          for (const key of allKeys) {
            // Skip internal fields
            if (key === 'updated_at' || key === 'created_at') continue;

            const oldVal = oldVals[key];
            const newVal = newVals[key];

            // Compare values (handle null/undefined)
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              result[recordId].fields.add(key);
            }
          }
        } catch (e) {
          // JSON parse error, skip this entry
          console.error('Error parsing audit values:', e);
        }
      }

      // Convert Sets to arrays for JSON serialization
      const response = {};
      for (const [recordId, data] of Object.entries(result)) {
        response[recordId] = {
          fields: Array.from(data.fields),
          updated_at: data.updated_at
        };
      }

      res.json(response);
    } catch (err) {
      console.error('Recent changes error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== DATE MOVEMENT HISTORY (for showing if dates have ever been changed) =====
  app.get('/api/date-changes', authenticateToken, async (req, res) => {
    try {
      const { table_name, record_ids, fields } = req.query;

      if (!table_name) {
        return res.status(400).json({ error: 'table_name is required' });
      }

      // Parse record_ids - can be comma-separated or single value
      let ids = [];
      if (record_ids) {
        ids = record_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      // Parse fields to check - e.g., "start_date,end_date" or "target_date"
      let fieldsToCheck = [];
      if (fields) {
        fieldsToCheck = fields.split(',').map(f => f.trim());
      }

      if (ids.length === 0) {
        return res.json({});
      }

      // Query audit log for any changes to these records (no time limit)
      let query = `
        SELECT record_id, old_values, new_values, created_at
        FROM audit_log
        WHERE table_name = ?
          AND action = 'UPDATE'
          AND record_id IN (${ids.map(() => '?').join(',')})
        ORDER BY created_at ASC
      `;
      let params = [table_name, ...ids];

      const changes = await dbAll(query, params);

      // Process changes to determine which date fields have ever changed
      const result = {};

      for (const change of changes) {
        const recordId = change.record_id;
        if (!result[recordId]) {
          result[recordId] = { dateFieldsChanged: {}, firstChangeDate: null };
        }

        try {
          const oldVals = change.old_values ? JSON.parse(change.old_values) : {};
          const newVals = change.new_values ? JSON.parse(change.new_values) : {};

          // Check if specified date fields changed
          for (const field of fieldsToCheck) {
            const oldVal = oldVals[field];
            const newVal = newVals[field];

            // If values differ, mark as changed
            if (oldVal !== undefined || newVal !== undefined) {
              if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                if (!result[recordId].dateFieldsChanged[field]) {
                  result[recordId].dateFieldsChanged[field] = {
                    firstChanged: change.created_at,
                    originalValue: oldVal,
                    changeCount: 0,
                    history: [] // Array of {date, changedAt} for all prior values
                  };
                  // Add original value to history if it exists
                  if (oldVal) {
                    result[recordId].dateFieldsChanged[field].history.push({
                      date: oldVal,
                      changedAt: change.created_at,
                      wasOriginal: true
                    });
                  }
                }
                result[recordId].dateFieldsChanged[field].changeCount++;
                result[recordId].dateFieldsChanged[field].latestValue = newVal;
                result[recordId].dateFieldsChanged[field].latestChange = change.created_at;
                // Add each new value to history
                if (newVal) {
                  result[recordId].dateFieldsChanged[field].history.push({
                    date: newVal,
                    changedAt: change.created_at,
                    wasOriginal: false
                  });
                }
              }
            }
          }
        } catch (e) {
          // JSON parse error, skip this entry
          console.error('Error parsing audit values:', e);
        }
      }

      res.json(result);
    } catch (err) {
      console.error('Date changes error:', err);
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
        ['system@progress-tracker', 'System', hash, 'pm']
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

      // 1. Projects without descriptions (include primary PM, secondary PM, and portfolio manager)
      const projectsWithoutDesc = await dbAll(`
        SELECT
          p.id as project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.secondary_pm,
          u.name as portfolio_manager_name,
          p.created_at as first_detected
        FROM projects p
        LEFT JOIN portfolios port ON p.portfolio_id = port.id
        LEFT JOIN users u ON port.manager_id = u.id
        WHERE p.description IS NULL OR p.description = ''
        ORDER BY p.initiative_manager, p.name
      `);

      for (const project of projectsWithoutDesc) {
        // Add for primary PM
        if (project.pm_name) {
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
        // Add for secondary PM if different from primary
        if (project.secondary_pm && project.secondary_pm !== project.pm_name) {
          inconsistencies.push({
            type: 'missing_project_description',
            severity: 'low',
            pm_name: project.secondary_pm,
            project_id: project.project_id,
            project_name: project.project_name,
            metric_id: null,
            metric_name: null,
            details: 'Project missing description',
            first_detected: project.first_detected,
            age_days: Math.floor((Date.now() - new Date(project.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        // Add for portfolio manager if different from primary and secondary PM
        if (project.portfolio_manager_name && project.portfolio_manager_name !== project.pm_name && project.portfolio_manager_name !== project.secondary_pm) {
          inconsistencies.push({
            type: 'missing_project_description',
            severity: 'low',
            pm_name: project.portfolio_manager_name,
            project_id: project.project_id,
            project_name: project.project_name,
            metric_id: null,
            metric_name: null,
            details: 'Project missing description',
            first_detected: project.first_detected,
            age_days: Math.floor((Date.now() - new Date(project.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // 2. Metrics without descriptions (include primary PM, secondary PM, and portfolio manager)
      const metricsWithoutDescriptions = await dbAll(`
        SELECT
          m.id as metric_id,
          m.name as metric_name,
          m.project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.secondary_pm,
          u.name as portfolio_manager_name,
          m.created_at as first_detected
        FROM metrics m
        JOIN projects p ON m.project_id = p.id
        LEFT JOIN portfolios port ON p.portfolio_id = port.id
        LEFT JOIN users u ON port.manager_id = u.id
        WHERE m.description IS NULL OR TRIM(m.description) = ''
        ORDER BY p.initiative_manager, p.name, m.name
      `);

      for (const metric of metricsWithoutDescriptions) {
        if (metric.pm_name) {
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
        if (metric.secondary_pm && metric.secondary_pm !== metric.pm_name) {
          inconsistencies.push({
            type: 'missing_metric_description',
            severity: 'low',
            pm_name: metric.secondary_pm,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: 'Metric missing description',
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        // Add for portfolio manager if different from primary and secondary PM
        if (metric.portfolio_manager_name && metric.portfolio_manager_name !== metric.pm_name && metric.portfolio_manager_name !== metric.secondary_pm) {
          inconsistencies.push({
            type: 'missing_metric_description',
            severity: 'low',
            pm_name: metric.portfolio_manager_name,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: 'Metric missing description',
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // 3. Projects without documentation links (include primary PM, secondary PM, and portfolio manager)
      const projectsWithoutDocs = await dbAll(`
        SELECT
          p.id as project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.secondary_pm,
          u.name as portfolio_manager_name,
          p.created_at as first_detected
        FROM projects p
        LEFT JOIN project_links pl ON p.id = pl.project_id
        LEFT JOIN portfolios port ON p.portfolio_id = port.id
        LEFT JOIN users u ON port.manager_id = u.id
        WHERE pl.id IS NULL
        ORDER BY p.initiative_manager, p.name
      `);

      for (const proj of projectsWithoutDocs) {
        if (proj.pm_name) {
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
        if (proj.secondary_pm && proj.secondary_pm !== proj.pm_name) {
          inconsistencies.push({
            type: 'missing_documentation',
            severity: 'low',
            pm_name: proj.secondary_pm,
            project_id: proj.project_id,
            project_name: proj.project_name,
            details: 'Project has no documentation links',
            first_detected: proj.first_detected,
            age_days: Math.floor((Date.now() - new Date(proj.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        // Add for portfolio manager if different from primary and secondary PM
        if (proj.portfolio_manager_name && proj.portfolio_manager_name !== proj.pm_name && proj.portfolio_manager_name !== proj.secondary_pm) {
          inconsistencies.push({
            type: 'missing_documentation',
            severity: 'low',
            pm_name: proj.portfolio_manager_name,
            project_id: proj.project_id,
            project_name: proj.project_name,
            details: 'Project has no documentation links',
            first_detected: proj.first_detected,
            age_days: Math.floor((Date.now() - new Date(proj.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // 4. Metrics that are red or amber but have no recovery plan
      // Calculate RAG status in SQL using window functions
      // Logic:
      // - If current period has value: use it
      // - If current period ended with no value: red (missing data)
      // - If current period not ended and no value: carry forward previous period's status
      const metricsNeedingRecovery = await dbAll(`
        WITH RankedPeriods AS (
          SELECT
            mp.metric_id,
            mp.reporting_date,
            mp.complete,
            mp.expected,
            m.frequency,
            ROW_NUMBER() OVER (PARTITION BY mp.metric_id ORDER BY mp.reporting_date DESC) as rn,
            LEAD(mp.reporting_date) OVER (PARTITION BY mp.metric_id ORDER BY mp.reporting_date) as next_date
          FROM metric_periods mp
          JOIN metrics m ON mp.metric_id = m.id
          WHERE mp.reporting_date <= DATE('now')
        ),
        PeriodsWithMeta AS (
          SELECT
            metric_id,
            reporting_date,
            complete,
            expected,
            frequency,
            next_date,
            rn,
            CASE
              WHEN next_date IS NULL OR DATE('now') < next_date THEN 1
              ELSE 0
            END as is_current_period,
            -- Calculate period end date based on frequency (default monthly)
            CASE COALESCE(frequency, 'monthly')
              WHEN 'weekly' THEN DATE(reporting_date, '+7 days')
              WHEN 'fortnightly' THEN DATE(reporting_date, '+14 days')
              WHEN 'monthly' THEN DATE(reporting_date, '+1 month')
              WHEN 'quarterly' THEN DATE(reporting_date, '+3 months')
              ELSE DATE(reporting_date, '+1 month')
            END as period_end_date,
            -- Has a complete value entered (0 is the database default, treat as no value)
            CASE WHEN complete IS NOT NULL AND complete != '' AND complete != 0 THEN 1 ELSE 0 END as has_complete_value
          FROM RankedPeriods
        ),
        CurrentAndPrevious AS (
          SELECT
            curr.metric_id,
            curr.complete as curr_complete,
            curr.expected as curr_expected,
            curr.has_complete_value as curr_has_value,
            CASE WHEN DATE('now') >= curr.period_end_date THEN 1 ELSE 0 END as curr_period_ended,
            prev.complete as prev_complete,
            prev.expected as prev_expected,
            CASE WHEN prev.complete IS NOT NULL AND prev.complete != '' AND prev.complete != 0 THEN 1 ELSE 0 END as prev_has_value
          FROM PeriodsWithMeta curr
          LEFT JOIN PeriodsWithMeta prev ON curr.metric_id = prev.metric_id AND prev.rn = 2
          WHERE curr.rn = 1
        ),
        RAGCalculation AS (
          SELECT
            cp.metric_id,
            m.name as metric_name,
            m.project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            p.secondary_pm,
            u.name as portfolio_manager_name,
            m.amber_tolerance,
            m.red_tolerance,
            m.created_at as first_detected,
            -- Determine which values to use
            CASE
              WHEN cp.curr_has_value = 1 THEN cp.curr_complete
              WHEN cp.curr_period_ended = 1 THEN cp.curr_complete
              WHEN cp.prev_has_value = 1 THEN cp.prev_complete
              ELSE NULL
            END as use_complete,
            CASE
              WHEN cp.curr_has_value = 1 THEN cp.curr_expected
              WHEN cp.curr_period_ended = 1 THEN cp.curr_expected
              WHEN cp.prev_has_value = 1 THEN cp.prev_expected
              ELSE NULL
            END as use_expected,
            -- Flag if we should skip (no current value, period not ended, no previous)
            CASE
              WHEN cp.curr_has_value = 0 AND cp.curr_period_ended = 0 AND cp.prev_has_value = 0 THEN 1
              ELSE 0
            END as should_skip
          FROM CurrentAndPrevious cp
          JOIN metrics m ON cp.metric_id = m.id
          JOIN projects p ON m.project_id = p.id
          LEFT JOIN portfolios port ON p.portfolio_id = port.id
          LEFT JOIN users u ON port.manager_id = u.id
          LEFT JOIN recovery_plans rp ON m.id = rp.metric_id AND rp.status = 'active'
          WHERE rp.id IS NULL
        )
        SELECT
          metric_id,
          metric_name,
          project_id,
          project_name,
          pm_name,
          secondary_pm,
          portfolio_manager_name,
          first_detected,
          CASE
            WHEN should_skip = 1 THEN 'grey'
            WHEN use_expected IS NULL OR use_expected = 0 THEN 'grey'
            WHEN COALESCE(use_complete, 0) >= use_expected THEN 'green'
            WHEN ABS((COALESCE(use_complete, 0) - use_expected) * 100.0 / use_expected) > red_tolerance THEN 'red'
            WHEN ABS((COALESCE(use_complete, 0) - use_expected) * 100.0 / use_expected) > amber_tolerance THEN 'amber'
            ELSE 'green'
          END as rag_status
        FROM RAGCalculation
        WHERE rag_status IN ('red', 'amber')
        ORDER BY pm_name, project_name, metric_name
      `);

      for (const metric of metricsNeedingRecovery) {
        if (metric.pm_name) {
          inconsistencies.push({
            type: 'missing_recovery_plan',
            severity: 'high',
            pm_name: metric.pm_name,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `${metric.metric_name} is ${metric.rag_status.toUpperCase()} but has no recovery plan`,
            rag_status: metric.rag_status,
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        if (metric.secondary_pm && metric.secondary_pm !== metric.pm_name) {
          inconsistencies.push({
            type: 'missing_recovery_plan',
            severity: 'high',
            pm_name: metric.secondary_pm,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `${metric.metric_name} is ${metric.rag_status.toUpperCase()} but has no recovery plan`,
            rag_status: metric.rag_status,
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        // Add for portfolio manager if different from primary and secondary PM
        if (metric.portfolio_manager_name && metric.portfolio_manager_name !== metric.pm_name && metric.portfolio_manager_name !== metric.secondary_pm) {
          inconsistencies.push({
            type: 'missing_recovery_plan',
            severity: 'high',
            pm_name: metric.portfolio_manager_name,
            project_id: metric.project_id,
            project_name: metric.project_name,
            metric_id: metric.metric_id,
            metric_name: metric.metric_name,
            details: `${metric.metric_name} is ${metric.rag_status.toUpperCase()} but has no recovery plan`,
            rag_status: metric.rag_status,
            first_detected: metric.first_detected,
            age_days: Math.floor((Date.now() - new Date(metric.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // 5. Unresolved feedback (include primary PM, secondary PM, and portfolio manager)
      const unresolvedFeedback = await dbAll(`
        SELECT
          f.id as feedback_id,
          f.text as feedback_text,
          f.project_id,
          p.name as project_name,
          p.initiative_manager as pm_name,
          p.secondary_pm,
          u.name as portfolio_manager_name,
          f.created_at as first_detected
        FROM feedback f
        JOIN projects p ON f.project_id = p.id
        LEFT JOIN portfolios port ON p.portfolio_id = port.id
        LEFT JOIN users u ON port.manager_id = u.id
        WHERE f.status != 'resolved'
        ORDER BY p.initiative_manager, p.name
      `);

      for (const fb of unresolvedFeedback) {
        const feedbackPreview = fb.feedback_text?.length > 50
          ? fb.feedback_text.substring(0, 50) + '...'
          : fb.feedback_text;

        if (fb.pm_name) {
          inconsistencies.push({
            type: 'unresolved_feedback',
            severity: 'medium',
            pm_name: fb.pm_name,
            project_id: fb.project_id,
            project_name: fb.project_name,
            feedback_id: fb.feedback_id,
            details: feedbackPreview,
            first_detected: fb.first_detected,
            age_days: Math.floor((Date.now() - new Date(fb.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        if (fb.secondary_pm && fb.secondary_pm !== fb.pm_name) {
          inconsistencies.push({
            type: 'unresolved_feedback',
            severity: 'medium',
            pm_name: fb.secondary_pm,
            project_id: fb.project_id,
            project_name: fb.project_name,
            feedback_id: fb.feedback_id,
            details: feedbackPreview,
            first_detected: fb.first_detected,
            age_days: Math.floor((Date.now() - new Date(fb.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
        if (fb.portfolio_manager_name && fb.portfolio_manager_name !== fb.pm_name && fb.portfolio_manager_name !== fb.secondary_pm) {
          inconsistencies.push({
            type: 'unresolved_feedback',
            severity: 'medium',
            pm_name: fb.portfolio_manager_name,
            project_id: fb.project_id,
            project_name: fb.project_name,
            feedback_id: fb.feedback_id,
            details: feedbackPreview,
            first_detected: fb.first_detected,
            age_days: Math.floor((Date.now() - new Date(fb.first_detected)) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Severity order for sorting (high = 0, medium = 1, low = 2)
      const severityOrder = { high: 0, medium: 1, low: 2 };

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

      // Sort issues within each PM by severity (high first), then by type
      Object.values(byPM).forEach(pmData => {
        pmData.issues.sort((a, b) => {
          // First by severity
          const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
          if (severityDiff !== 0) return severityDiff;
          // Then by type (missing_recovery_plan first)
          if (a.type === 'missing_recovery_plan' && b.type !== 'missing_recovery_plan') return -1;
          if (b.type === 'missing_recovery_plan' && a.type !== 'missing_recovery_plan') return 1;
          // Then alphabetically by project name
          return (a.project_name || '').localeCompare(b.project_name || '');
        });
      });

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

  // Endpoint to get chaser email content for a space (formatted for easy copy/paste)
  app.get('/api/chaser-report/:spaceId', authenticateToken, async (req, res) => {
    try {
      const { spaceId } = req.params;

      // Get all users for email lookup (by name, case-insensitive)
      const allUsers = await dbAll('SELECT name, email FROM users WHERE email IS NOT NULL');
      const userEmailMap = {};
      for (const u of allUsers) {
        if (u.name) {
          userEmailMap[u.name.toLowerCase().trim()] = u.email;
        }
      }

      // Helper to look up email by PM name
      const getEmail = (pmName) => {
        if (!pmName) return null;
        return userEmailMap[pmName.toLowerCase().trim()] || null;
      };

      // Build inconsistencies for projects in this space
      const inconsistencies = [];

      // 1. Projects without descriptions
      const projectsWithoutDesc = await dbAll(`
        SELECT p.id as project_id, p.name as project_name, p.initiative_manager as pm_name, p.created_at
        FROM projects p
        JOIN portfolios pf ON p.portfolio_id = pf.id
        WHERE pf.space_id = ? AND (p.description IS NULL OR p.description = '')
      `, [spaceId]);

      for (const project of projectsWithoutDesc) {
        const ageDays = Math.floor((Date.now() - new Date(project.created_at)) / (1000 * 60 * 60 * 24));
        inconsistencies.push({
          pm_name: project.pm_name,
          project_name: project.project_name,
          issue: `Project missing description (${ageDays}d)`
        });
      }

      // 2. Metrics without descriptions
      const metricsWithoutDesc = await dbAll(`
        SELECT m.id, m.name as metric_name, p.name as project_name, p.initiative_manager as pm_name, m.created_at
        FROM metrics m
        JOIN projects p ON m.project_id = p.id
        JOIN portfolios pf ON p.portfolio_id = pf.id
        WHERE pf.space_id = ? AND (m.description IS NULL OR TRIM(m.description) = '')
      `, [spaceId]);

      for (const metric of metricsWithoutDesc) {
        const ageDays = Math.floor((Date.now() - new Date(metric.created_at)) / (1000 * 60 * 60 * 24));
        inconsistencies.push({
          pm_name: metric.pm_name,
          project_name: metric.project_name,
          issue: `Metric "${metric.metric_name}" missing description (${ageDays}d)`
        });
      }

      // 3. Projects without documentation links
      const projectsWithoutDocs = await dbAll(`
        SELECT p.id as project_id, p.name as project_name, p.initiative_manager as pm_name, p.created_at
        FROM projects p
        JOIN portfolios pf ON p.portfolio_id = pf.id
        LEFT JOIN project_links pl ON p.id = pl.project_id
        WHERE pf.space_id = ? AND pl.id IS NULL
      `, [spaceId]);

      for (const proj of projectsWithoutDocs) {
        const ageDays = Math.floor((Date.now() - new Date(proj.created_at)) / (1000 * 60 * 60 * 24));
        inconsistencies.push({
          pm_name: proj.pm_name,
          project_name: proj.project_name,
          issue: `Project has no documentation links (${ageDays}d)`
        });
      }

      // 4. Red metrics without recovery plans
      const redMetricsNoRecovery = await dbAll(`
        SELECT
          m.id,
          m.name as metric_name,
          p.name as project_name,
          p.initiative_manager as pm_name,
          m.created_at
        FROM metrics m
        JOIN projects p ON m.project_id = p.id
        JOIN portfolios pf ON p.portfolio_id = pf.id
        LEFT JOIN recovery_plans rp ON m.id = rp.metric_id AND rp.status = 'active'
        WHERE pf.space_id = ?
          AND rp.id IS NULL
          AND EXISTS (
            SELECT 1 FROM metric_periods mp
            WHERE mp.metric_id = m.id
            AND mp.complete IS NOT NULL
            AND mp.expected IS NOT NULL
            AND mp.expected > 0
            AND ((mp.expected - mp.complete) / mp.expected * 100) > COALESCE(m.red_tolerance, 10)
          )
      `, [spaceId]);

      for (const metric of redMetricsNoRecovery) {
        const ageDays = Math.floor((Date.now() - new Date(metric.created_at)) / (1000 * 60 * 60 * 24));
        inconsistencies.push({
          pm_name: metric.pm_name,
          project_name: metric.project_name,
          issue: `Metric "${metric.metric_name}" is red - needs recovery plan (${ageDays}d)`
        });
      }

      // 5. Projects with no initiative manager (use audit log to find creator)
      const projectsNoManager = await dbAll(`
        SELECT
          p.id as project_id,
          p.name as project_name,
          p.created_at,
          u.name as creator_name,
          u.email as creator_email
        FROM projects p
        JOIN portfolios pf ON p.portfolio_id = pf.id
        LEFT JOIN audit_log al ON al.table_name = 'projects'
          AND al.record_id = p.id
          AND al.action = 'CREATE'
        LEFT JOIN users u ON al.user_id = u.id
        WHERE pf.space_id = ?
          AND (p.initiative_manager IS NULL OR TRIM(p.initiative_manager) = '')
      `, [spaceId]);

      for (const project of projectsNoManager) {
        const ageDays = Math.floor((Date.now() - new Date(project.created_at)) / (1000 * 60 * 60 * 24));
        const responsibleName = project.creator_name || 'Unknown';
        inconsistencies.push({
          pm_name: responsibleName,
          pm_email: project.creator_email,
          project_name: project.project_name,
          issue: `Project has no initiative manager (${ageDays}d)`
        });
      }

      // 6. Projects with only one metric
      const singleMetricProjects = await dbAll(`
        WITH project_metric_counts AS (
          SELECT
            p.id as project_id,
            p.name as project_name,
            p.initiative_manager as pm_name,
            p.created_at,
            COUNT(m.id) as metric_count
          FROM projects p
          JOIN portfolios pf ON p.portfolio_id = pf.id
          LEFT JOIN metrics m ON p.id = m.project_id
          WHERE pf.space_id = ?
          GROUP BY p.id
        )
        SELECT * FROM project_metric_counts
        WHERE metric_count = 1
      `, [spaceId]);

      for (const project of singleMetricProjects) {
        const ageDays = Math.floor((Date.now() - new Date(project.created_at)) / (1000 * 60 * 60 * 24));
        inconsistencies.push({
          pm_name: project.pm_name,
          project_name: project.project_name,
          issue: `Project has only one metric (${ageDays}d)`
        });
      }

      // Deduplicate inconsistencies using a Set
      const seenIssues = new Set();
      const uniqueInconsistencies = inconsistencies.filter(item => {
        const key = `${item.pm_name}|${item.project_name}|${item.issue}`;
        if (seenIssues.has(key)) {
          return false;
        }
        seenIssues.add(key);
        return true;
      });

      if (uniqueInconsistencies.length === 0) {
        return res.json({ emails: '', sections: 'No inconsistencies found for this space.', pmCount: 0, issueCount: 0 });
      }

      // Group by PM
      const byPM = {};
      for (const item of uniqueInconsistencies) {
        const key = item.pm_name || 'Unknown';
        if (!byPM[key]) {
          byPM[key] = {
            pm_name: item.pm_name,
            pm_email: item.pm_email || getEmail(item.pm_name), // Use direct email if provided, else lookup
            issues: []
          };
        }
        // If we have a direct email and didn't have one before, use it
        if (item.pm_email && !byPM[key].pm_email) {
          byPM[key].pm_email = item.pm_email;
        }
        byPM[key].issues.push({
          project: item.project_name,
          issue: item.issue
        });
      }

      // Get unique emails for delinquent PMs
      const delinquentEmails = [...new Set(
        Object.values(byPM)
          .map(pm => pm.pm_email)
          .filter(email => email)
      )];

      // Format sections by person
      const sections = Object.values(byPM)
        .sort((a, b) => (a.pm_name || '').localeCompare(b.pm_name || ''))
        .map(pm => {
          const issuesByProject = {};
          for (const issue of pm.issues) {
            if (!issuesByProject[issue.project]) {
              issuesByProject[issue.project] = [];
            }
            issuesByProject[issue.project].push(issue.issue);
          }

          const projectLines = Object.entries(issuesByProject)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([project, issues]) => {
              return `  ${project}:\n${issues.map(i => `    - ${i}`).join('\n')}`;
            })
            .join('\n');

          return `${pm.pm_name || 'Unknown'}:\n${projectLines}`;
        })
        .join('\n\n');

      res.json({
        emails: delinquentEmails.join('; '),
        sections,
        pmCount: Object.keys(byPM).length,
        issueCount: uniqueInconsistencies.length
      });
    } catch (err) {
      console.error('Error generating chaser report:', err);
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
      const { path, session_id, load_time_ms } = req.body;
      const userId = req.user?.userId || null;

      if (!path) {
        return res.status(204).send(); // Silent fail if no path
      }

      // Store page view asynchronously (fire and forget)
      dbRun(
        'INSERT INTO page_views (user_id, path, session_id, load_time_ms) VALUES (?, ?, ?, ?)',
        [userId, path, session_id, load_time_ms || null]
      ).catch(err => {
        console.error('Page view tracking error:', err);
      });

      res.status(204).send();
    } catch (err) {
      console.error('Page view endpoint error:', err);
      res.status(204).send(); // Always return 204 to not break client
    }
  });

  // Get project view counts (public - just project names and view counts)
  app.get('/api/project-views', optionalAuthenticateToken, async (req, res) => {
    try {
      const { days = 30, space_id } = req.query;
      const daysAgo = new Date();
      const parsedDays = parseInt(days) || 30;
      daysAgo.setDate(daysAgo.getDate() - parsedDays);

      console.log('Project views request - days:', parsedDays, 'space_id:', space_id);

      // Build space filter
      const spaceFilter = space_id ? `AND po.space_id = ${parseInt(space_id)}` : '';

      // Get project view counts only (INNER JOIN to exclude deleted projects)
      const projectViews = await dbAll(`
        SELECT pv.path, COUNT(*) as views
        FROM page_views pv
        INNER JOIN projects p ON pv.path = 'Project: ' || p.name
        LEFT JOIN portfolios po ON p.portfolio_id = po.id
        WHERE pv.created_at >= ? AND pv.path LIKE 'Project:%' ${spaceFilter}
        GROUP BY pv.path
        ORDER BY views DESC
        LIMIT 20
      `, [daysAgo.toISOString()]);

      console.log('Project views result:', projectViews.length, 'items');

      res.json({
        by_path: projectViews,
        period: parsedDays
      });
    } catch (err) {
      console.error('Project views error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get changes since user's last visit (space-aware)
  app.get('/api/changes-since-last-visit', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { space_id } = req.query;

      // Get user's previous visit timestamp (second most recent home page visit)
      // We want the PREVIOUS visit, not the current one
      const lastVisits = await dbAll(`
        SELECT created_at FROM page_views
        WHERE user_id = ? AND (path = '/' OR path = 'Home')
        ORDER BY created_at DESC
        LIMIT 2
      `, [userId]);

      // If no previous visit, use 24 hours ago as default
      let lastVisitTime;
      if (lastVisits.length < 2) {
        // First visit or only one visit - show changes from last 24 hours
        lastVisitTime = new Date();
        lastVisitTime.setHours(lastVisitTime.getHours() - 24);
      } else {
        lastVisitTime = new Date(lastVisits[1].created_at);
      }

      // Build space filter for projects
      const spaceFilter = space_id ? `AND po.space_id = ${parseInt(space_id)}` : '';

      // Count audit log changes for projects in the space since last visit
      const changes = await dbAll(`
        SELECT
          a.action,
          a.table_name,
          COUNT(*) as count
        FROM audit_log a
        LEFT JOIN projects p ON (
          (a.table_name = 'projects' AND a.record_id = p.id) OR
          (a.table_name = 'metrics' AND a.record_id IN (SELECT id FROM metrics WHERE project_id = p.id)) OR
          (a.table_name = 'metric_periods' AND a.record_id IN (SELECT mp.id FROM metric_periods mp JOIN metrics m ON mp.metric_id = m.id WHERE m.project_id = p.id))
        )
        LEFT JOIN portfolios po ON p.portfolio_id = po.id
        WHERE a.created_at > ?
          AND a.table_name IN ('projects', 'metrics', 'metric_periods', 'recovery_plans')
          AND (p.id IS NOT NULL ${spaceFilter} OR a.table_name = 'recovery_plans')
        GROUP BY a.action, a.table_name
      `, [lastVisitTime.toISOString()]);

      // Calculate total changes
      const totalChanges = changes.reduce((sum, c) => sum + c.count, 0);

      // Get some detail about what changed
      const breakdown = {
        metric_updates: changes.filter(c => c.table_name === 'metric_periods').reduce((sum, c) => sum + c.count, 0),
        new_metrics: changes.filter(c => c.table_name === 'metrics' && c.action === 'CREATE').reduce((sum, c) => sum + c.count, 0),
        project_updates: changes.filter(c => c.table_name === 'projects').reduce((sum, c) => sum + c.count, 0),
        recovery_plans: changes.filter(c => c.table_name === 'recovery_plans').reduce((sum, c) => sum + c.count, 0)
      };

      res.json({
        total: totalChanges,
        breakdown,
        since: lastVisitTime.toISOString(),
        is_first_visit: lastVisits.length < 2
      });
    } catch (err) {
      console.error('Changes since last visit error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get database stats (admin only)
  app.get('/api/admin/database-stats', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get all table names
      const tables = await dbAll(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);

      // Estimated average bytes per row for each table type
      const avgBytesPerRow = {
        page_views: 150,      // timestamp, user_id, page, project_id, etc
        metric_periods: 100,  // metric_id, period dates, values
        audit_log: 300,       // user, action, details JSON, timestamp
        periods: 80,          // dates and status
        users: 200,           // name, email, password hash, settings
        feedback: 250,        // text content, user, project, status
        comments: 400,        // comment text can be longer
        permissions: 50,      // just IDs and role
        craids: 350,          // description, status, dates
        metrics: 200,         // name, description, settings
        projects: 400,        // name, description, settings
        portfolios: 150,      // name, description
        spaces: 100,          // name, settings
        project_links: 150,   // url, title, type
        recovery_plans: 300,  // plan text, dates
      };
      const defaultBytesPerRow = 150;

      // Get row count and estimate size for each table
      const tableStats = [];
      for (const table of tables) {
        try {
          const countResult = await dbGet(`SELECT COUNT(*) as count FROM "${table.name}"`);
          const rowCount = countResult.count;
          const bytesPerRow = avgBytesPerRow[table.name] || defaultBytesPerRow;
          const estimatedBytes = rowCount * bytesPerRow;
          tableStats.push({
            name: table.name,
            rowCount,
            estimatedBytes,
            estimatedKB: Math.round(estimatedBytes / 1024 * 10) / 10
          });
        } catch (err) {
          tableStats.push({ name: table.name, rowCount: -1, estimatedBytes: 0, error: err.message });
        }
      }

      // Get database file size
      const fs = require('fs');
      const path = require('path');
      // Try multiple possible database paths
      const possiblePaths = [
        process.env.DATABASE_PATH,
        path.join(__dirname, '..', 'data', 'progress-tracker.db'),
        path.join(process.cwd(), 'backend', 'data', 'progress-tracker.db'),
        'backend/data/progress-tracker.db'
      ].filter(Boolean);

      let totalSizeBytes = 0;
      for (const dbPath of possiblePaths) {
        try {
          const stats = fs.statSync(dbPath);
          totalSizeBytes = stats.size;
          break; // Found it, stop looking
        } catch (err) {
          // Try next path
        }
      }
      if (totalSizeBytes === 0) {
        console.error('Could not find database file to get size');
      }

      // Get space usage - estimate based on project/metric data per space
      const spaceUsage = await dbAll(`
        SELECT
          s.id as spaceId,
          s.name as spaceName,
          COUNT(DISTINCT p.id) as projectCount,
          COUNT(DISTINCT m.id) as metricCount,
          COUNT(DISTINCT mp.id) as periodCount
        FROM spaces s
        LEFT JOIN portfolios po ON po.space_id = s.id
        LEFT JOIN projects p ON p.portfolio_id = po.id
        LEFT JOIN metrics m ON m.project_id = p.id
        LEFT JOIN metric_periods mp ON mp.metric_id = m.id
        GROUP BY s.id, s.name
        ORDER BY periodCount DESC
      `);

      // Get all indexes
      const indexes = await dbAll(`
        SELECT
          name,
          tbl_name as tableName,
          sql
        FROM sqlite_master
        WHERE type='index'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY tbl_name, name
      `);

      res.json({
        tables: tableStats,
        totalSizeBytes,
        spaceUsage,
        indexes
      });
    } catch (err) {
      console.error('Database stats error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get active users (admin only) - users with page views in last 30 minutes
  app.get('/api/admin/active-users', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      // Format as SQLite-compatible datetime (YYYY-MM-DD HH:MM:SS)
      const sqliteTimestamp = thirtyMinutesAgo.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

      const activeUsers = await dbAll(`
        SELECT
          u.id,
          u.name,
          u.email,
          MAX(pv.created_at) as lastActivity,
          COUNT(pv.id) as pageViews
        FROM page_views pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.created_at >= ?
        GROUP BY u.id, u.name, u.email
        ORDER BY lastActivity DESC
      `, [sqliteTimestamp]);

      res.json({
        users: activeUsers,
        count: activeUsers.length,
        since: thirtyMinutesAgo.toISOString()
      });
    } catch (err) {
      console.error('Active users error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get inactive PMs ranked by time since last login (admin only)
  app.get('/api/admin/inactive-pms', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get all PMs and their last activity
      const inactivePMs = await dbAll(`
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          MAX(pv.created_at) as lastActivity,
          COUNT(pv.id) as totalPageViews
        FROM users u
        LEFT JOIN page_views pv ON pv.user_id = u.id
        WHERE u.role = 'pm'
        GROUP BY u.id, u.name, u.email, u.role
        ORDER BY lastActivity ASC NULLS FIRST
      `);

      // Calculate time since last activity
      const now = new Date();
      const pmsWithInactivity = inactivePMs.map(pm => {
        if (!pm.lastActivity) {
          return {
            ...pm,
            daysSinceLogin: null,
            neverLoggedIn: true
          };
        }
        const lastActive = new Date(pm.lastActivity);
        const diffMs = now - lastActive;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return {
          ...pm,
          daysSinceLogin: diffDays,
          neverLoggedIn: false
        };
      });

      res.json({
        pms: pmsWithInactivity,
        count: pmsWithInactivity.length
      });
    } catch (err) {
      console.error('Inactive PMs error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get page heatmap data (admin only) - filtered for projects only
  app.get('/api/admin/page-heatmap', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { days = 30, space_id } = req.query;
      const daysAgo = new Date();
      const parsedDays = parseInt(days) || 30; // Default to 30 if invalid
      daysAgo.setDate(daysAgo.getDate() - parsedDays);

      // Build space filter
      const spaceFilter = space_id ? `AND po.space_id = ${parseInt(space_id)}` : '';

      // Get page view counts (only Project pages), filtered by space if provided
      const pageViewCounts = await dbAll(`
        SELECT pv.path, COUNT(*) as view_count
        FROM page_views pv
        LEFT JOIN projects p ON pv.path = 'Project: ' || p.name
        LEFT JOIN portfolios po ON p.portfolio_id = po.id
        WHERE pv.created_at >= ? AND pv.path LIKE 'Project:%' ${spaceFilter}
        GROUP BY pv.path
        ORDER BY view_count DESC
      `, [daysAgo.toISOString()]);

      // Get timeline data (views by date), filtered by space
      const timeline = await dbAll(`
        SELECT DATE(pv.created_at) as date, COUNT(*) as views
        FROM page_views pv
        LEFT JOIN projects p ON pv.path = 'Project: ' || p.name
        LEFT JOIN portfolios po ON p.portfolio_id = po.id
        WHERE pv.created_at >= ? AND pv.path LIKE 'Project:%' ${spaceFilter}
        GROUP BY DATE(pv.created_at)
        ORDER BY date
      `, [daysAgo.toISOString()]);

      // Get top users by view count, filtered by space
      const topUsers = await dbAll(`
        SELECT
          COALESCE(u.name, 'Anonymous') as user_name,
          u.email as user_email,
          COUNT(*) as view_count
        FROM page_views pv
        LEFT JOIN users u ON pv.user_id = u.id
        LEFT JOIN projects p ON pv.path = 'Project: ' || p.name
        LEFT JOIN portfolios po ON p.portfolio_id = po.id
        WHERE pv.created_at >= ? AND pv.path LIKE 'Project:%' ${spaceFilter}
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

  // Get page performance stats
  // Outlier threshold (10s) excludes cold starts/release reloads for cleaner metrics
  const OUTLIER_THRESHOLD_MS = 10000;

  // Helper to calculate percentile from sorted array
  const calculatePercentile = (sortedArr, percentile) => {
    if (!sortedArr || sortedArr.length === 0) return null;
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  };

  app.get('/api/analytics/performance', optionalAuthenticateToken, async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const cacheKey = cacheKeys.analyticsPerformance(days);

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for analytics performance: ${days} days`);
        return res.json(cached);
      }

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      const retentionDays = 30; // Must match the aggregation job setting
      const retentionCutoff = new Date();
      retentionCutoff.setDate(retentionCutoff.getDate() - retentionDays);

      // Get recent load times for percentile calculation
      const recentLoadTimes = await dbAll(`
        SELECT load_time_ms
        FROM page_views
        WHERE created_at >= ? AND load_time_ms IS NOT NULL
        ORDER BY load_time_ms
      `, [daysAgo.toISOString()]);
      const recentSorted = recentLoadTimes.map(r => r.load_time_ms);

      // Get historical percentiles from summary (weighted average approximation)
      const historicalPercentiles = await dbGet(`
        SELECT
          SUM(p50_load_time * views_with_timing) / NULLIF(SUM(views_with_timing), 0) as p50,
          SUM(p90_load_time * views_with_timing) / NULLIF(SUM(views_with_timing), 0) as p90,
          SUM(views_with_timing) as views_count
        FROM page_views_daily_summary
        WHERE summary_date >= DATE(?) AND summary_date < DATE(?)
        AND p50_load_time IS NOT NULL
      `, [daysAgo.toISOString(), retentionCutoff.toISOString()]);

      // Combine recent and historical for overall percentiles
      const recentP50 = calculatePercentile(recentSorted, 50);
      const recentP90 = calculatePercentile(recentSorted, 90);
      const recentCount = recentSorted.length;
      const histCount = historicalPercentiles?.views_count || 0;
      const totalCount = recentCount + histCount;

      // Weighted average of percentiles
      let overallP50 = recentP50;
      let overallP90 = recentP90;
      if (histCount > 0 && historicalPercentiles.p50) {
        overallP50 = totalCount > 0
          ? Math.round((recentP50 * recentCount + historicalPercentiles.p50 * histCount) / totalCount)
          : historicalPercentiles.p50;
        overallP90 = totalCount > 0
          ? Math.round((recentP90 * recentCount + historicalPercentiles.p90 * histCount) / totalCount)
          : historicalPercentiles.p90;
      }

      // Overall stats
      const overallStats = await dbGet(`
        SELECT
          SUM(total_avg * views_count) / NULLIF(SUM(views_count), 0) as avg_load_time,
          MIN(min_load_time) as min_load_time,
          MAX(max_load_time) as max_load_time,
          SUM(total_views) as total_views,
          SUM(views_count) as views_with_timing
        FROM (
          -- Recent detailed data
          SELECT
            AVG(load_time_ms) as total_avg,
            MIN(load_time_ms) as min_load_time,
            MAX(load_time_ms) as max_load_time,
            COUNT(*) as total_views,
            COUNT(load_time_ms) as views_count
          FROM page_views
          WHERE created_at >= ? AND load_time_ms IS NOT NULL

          UNION ALL

          -- Historical aggregated data
          SELECT
            avg_load_time as total_avg,
            min_load_time,
            max_load_time,
            total_views,
            views_with_timing as views_count
          FROM page_views_daily_summary
          WHERE summary_date >= DATE(?) AND summary_date < DATE(?)
          AND avg_load_time IS NOT NULL
        )
      `, [daysAgo.toISOString(), daysAgo.toISOString(), retentionCutoff.toISOString()]);

      // Count outliers for transparency
      const outlierCount = await dbGet(`
        SELECT COUNT(*) as count FROM page_views
        WHERE created_at >= ? AND load_time_ms > ?
      `, [daysAgo.toISOString(), OUTLIER_THRESHOLD_MS]);

      // Daily trend with true percentiles
      // For recent data, calculate actual p50/p90 per day in JavaScript
      const recentDailyRaw = await dbAll(`
        SELECT DATE(created_at) as date, load_time_ms
        FROM page_views
        WHERE created_at >= ? AND load_time_ms IS NOT NULL
        ORDER BY date, load_time_ms
      `, [daysAgo.toISOString()]);

      // Group by date and calculate percentiles
      const recentDailyMap = {};
      for (const row of recentDailyRaw) {
        if (!recentDailyMap[row.date]) {
          recentDailyMap[row.date] = [];
        }
        recentDailyMap[row.date].push(row.load_time_ms);
      }

      const recentDaily = Object.entries(recentDailyMap).map(([date, times]) => {
        const sorted = times.sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        return {
          date,
          avg_load_time: sum / sorted.length,
          p50_load_time: calculatePercentile(sorted, 50),
          p90_load_time: calculatePercentile(sorted, 90),
          views: sorted.length
        };
      });

      // Get historical aggregated data
      const historicalDaily = await dbAll(`
        SELECT
          summary_date as date,
          avg_load_time,
          COALESCE(p50_load_time, avg_load_time) as p50_load_time,
          COALESCE(p90_load_time, avg_load_time) as p90_load_time,
          total_views as views
        FROM page_views_daily_summary
        WHERE summary_date >= DATE(?) AND summary_date < DATE(?)
        AND avg_load_time IS NOT NULL
        ORDER BY summary_date
      `, [daysAgo.toISOString(), retentionCutoff.toISOString()]);

      // Merge recent and historical, recent takes precedence
      const recentDates = new Set(recentDaily.map(d => d.date));
      const dailyTrend = [
        ...historicalDaily.filter(d => !recentDates.has(d.date)),
        ...recentDaily
      ].sort((a, b) => a.date.localeCompare(b.date));

      // Top 10 slowest pages by p90 (more meaningful than avg for outliers)
      const slowestPages = await dbAll(`
        SELECT
          path,
          SUM(total_avg * views_count) / NULLIF(SUM(views_count), 0) as avg_load_time,
          SUM(p50 * views_count) / NULLIF(SUM(views_count), 0) as p50_load_time,
          SUM(p90 * views_count) / NULLIF(SUM(views_count), 0) as p90_load_time,
          MIN(min_load_time) as min_load_time,
          MAX(max_load_time) as max_load_time,
          SUM(total_views) as views
        FROM (
          -- Recent detailed data
          SELECT
            path,
            AVG(load_time_ms) as total_avg,
            AVG(load_time_ms) as p50,
            AVG(load_time_ms) as p90,
            MIN(load_time_ms) as min_load_time,
            MAX(load_time_ms) as max_load_time,
            COUNT(*) as total_views,
            COUNT(load_time_ms) as views_count
          FROM page_views
          WHERE created_at >= ? AND load_time_ms IS NOT NULL
          GROUP BY path

          UNION ALL

          -- Historical aggregated data
          SELECT
            path,
            avg_load_time as total_avg,
            COALESCE(p50_load_time, avg_load_time) as p50,
            COALESCE(p90_load_time, avg_load_time) as p90,
            min_load_time,
            max_load_time,
            total_views,
            views_with_timing as views_count
          FROM page_views_path_summary
          WHERE summary_date >= DATE(?) AND summary_date < DATE(?)
          AND avg_load_time IS NOT NULL
        )
        GROUP BY path
        HAVING SUM(total_views) >= 3
        ORDER BY p90_load_time DESC
        LIMIT 10
      `, [daysAgo.toISOString(), daysAgo.toISOString(), retentionCutoff.toISOString()]);

      // Top 10 fastest pages by p50 (median)
      const fastestPages = await dbAll(`
        SELECT
          path,
          SUM(total_avg * views_count) / NULLIF(SUM(views_count), 0) as avg_load_time,
          SUM(p50 * views_count) / NULLIF(SUM(views_count), 0) as p50_load_time,
          SUM(p90 * views_count) / NULLIF(SUM(views_count), 0) as p90_load_time,
          MIN(min_load_time) as min_load_time,
          MAX(max_load_time) as max_load_time,
          SUM(total_views) as views
        FROM (
          -- Recent detailed data
          SELECT
            path,
            AVG(load_time_ms) as total_avg,
            AVG(load_time_ms) as p50,
            AVG(load_time_ms) as p90,
            MIN(load_time_ms) as min_load_time,
            MAX(load_time_ms) as max_load_time,
            COUNT(*) as total_views,
            COUNT(load_time_ms) as views_count
          FROM page_views
          WHERE created_at >= ? AND load_time_ms IS NOT NULL
          GROUP BY path

          UNION ALL

          -- Historical aggregated data
          SELECT
            path,
            avg_load_time as total_avg,
            COALESCE(p50_load_time, avg_load_time) as p50,
            COALESCE(p90_load_time, avg_load_time) as p90,
            min_load_time,
            max_load_time,
            total_views,
            views_with_timing as views_count
          FROM page_views_path_summary
          WHERE summary_date >= DATE(?) AND summary_date < DATE(?)
          AND avg_load_time IS NOT NULL
        )
        GROUP BY path
        HAVING SUM(total_views) >= 3
        ORDER BY p50_load_time ASC
        LIMIT 10
      `, [daysAgo.toISOString(), daysAgo.toISOString(), retentionCutoff.toISOString()]);

      const result = {
        overallStats: {
          avgLoadTime: Math.round(overallStats.avg_load_time) || 0,
          p50LoadTime: overallP50 || 0,
          p90LoadTime: overallP90 || 0,
          minLoadTime: overallStats.min_load_time || 0,
          maxLoadTime: overallStats.max_load_time || 0,
          totalViews: overallStats.total_views || 0,
          viewsWithTiming: overallStats.views_with_timing || 0,
          outlierCount: outlierCount?.count || 0,
          outlierThreshold: OUTLIER_THRESHOLD_MS
        },
        dailyTrend: dailyTrend.map(d => ({
          date: d.date,
          avgLoadTime: Math.round(d.avg_load_time),
          p50LoadTime: Math.round(d.p50_load_time || d.avg_load_time),
          p90LoadTime: Math.round(d.p90_load_time || d.avg_load_time),
          views: d.views
        })),
        slowestPages: slowestPages.map(p => ({
          path: p.path,
          avgLoadTime: Math.round(p.avg_load_time),
          p50LoadTime: Math.round(p.p50_load_time || p.avg_load_time),
          p90LoadTime: Math.round(p.p90_load_time || p.avg_load_time),
          minLoadTime: p.min_load_time,
          maxLoadTime: p.max_load_time,
          views: p.views
        })),
        fastestPages: fastestPages.map(p => ({
          path: p.path,
          avgLoadTime: Math.round(p.avg_load_time),
          p50LoadTime: Math.round(p.p50_load_time || p.avg_load_time),
          p90LoadTime: Math.round(p.p90_load_time || p.avg_load_time),
          minLoadTime: p.min_load_time,
          maxLoadTime: p.max_load_time,
          views: p.views
        })),
        period: days
      };

      // Cache for 15 minutes
      cache.set(cacheKey, result, 900);
      logger.debug(`Cache miss for analytics performance: ${days} days, cached result`);

      res.json(result);
    } catch (err) {
      console.error('Performance stats error:', err);
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

      const { days = 30, space_id } = req.query;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));

      // Build space filter - only filter project-related tables
      let spaceFilter = '';
      if (space_id) {
        spaceFilter = `
          AND (
            a.table_name NOT IN ('projects', 'metrics', 'metric_periods', 'comments')
            OR (a.table_name = 'projects' AND a.record_id IN (
              SELECT p.id FROM projects p
              LEFT JOIN portfolios po ON p.portfolio_id = po.id
              WHERE po.space_id = ${parseInt(space_id)}
            ))
            OR (a.table_name = 'metrics' AND a.record_id IN (
              SELECT m.id FROM metrics m
              LEFT JOIN projects p ON m.project_id = p.id
              LEFT JOIN portfolios po ON p.portfolio_id = po.id
              WHERE po.space_id = ${parseInt(space_id)}
            ))
            OR (a.table_name = 'metric_periods' AND a.record_id IN (
              SELECT mp.id FROM metric_periods mp
              LEFT JOIN metrics m ON mp.metric_id = m.id
              LEFT JOIN projects p ON m.project_id = p.id
              LEFT JOIN portfolios po ON p.portfolio_id = po.id
              WHERE po.space_id = ${parseInt(space_id)}
            ))
            OR (a.table_name = 'comments' AND a.record_id IN (
              SELECT c.id FROM comments c
              LEFT JOIN metric_periods mp ON c.period_id = mp.id
              LEFT JOIN metrics m ON mp.metric_id = m.id
              LEFT JOIN projects p ON m.project_id = p.id
              LEFT JOIN portfolios po ON p.portfolio_id = po.id
              WHERE po.space_id = ${parseInt(space_id)}
            ))
          )
        `;
      }

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
        WHERE a.created_at >= ? ${spaceFilter}
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
        WHERE a.created_at >= ? ${spaceFilter}
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
        WHERE a.created_at >= ? ${spaceFilter}
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

  // ===== GET EMAILS BY SPACE (Admin only) =====
  app.get('/api/admin/space-emails/:spaceId', authenticateToken, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { spaceId } = req.params;

      let emails;
      if (spaceId === 'all') {
        // Get all unique initiative managers across all projects
        emails = await dbAll(`
          SELECT DISTINCT u.email
          FROM users u
          INNER JOIN projects p ON u.name = p.initiative_manager
          WHERE u.email IS NOT NULL
          ORDER BY u.email
        `);
      } else {
        // Get initiative managers for projects in portfolios belonging to this space
        emails = await dbAll(`
          SELECT DISTINCT u.email
          FROM users u
          INNER JOIN projects p ON u.name = p.initiative_manager
          INNER JOIN portfolios po ON p.portfolio_id = po.id
          WHERE po.space_id = ? AND u.email IS NOT NULL
          ORDER BY u.email
        `, [spaceId]);
      }

      const emailList = emails.map(e => e.email).join('; ');

      res.json({
        count: emails.length,
        emails: emailList
      });
    } catch (err) {
      console.error('Get space emails error:', err);
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
      (allAuditLogs || []).forEach(log => {
        if (log.action === 'CREATE') {
          const recordId = log.record_id;
          let newValues = {};
          try {
            newValues = JSON.parse(log.new_values || '{}');
          } catch (e) {
            console.error('Invalid JSON in new_values for audit log:', log.id);
            return;
          }
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
              commentary: createdAt <= targetDate ? (newValues.commentary || null) : null,
              hasCreateEntry: true
            };
          }
        }
      });
  
      // For periods without CREATE audit entries, we need to work backwards from current state
      // Start with current values and reverse-apply changes that happened after target date
      (periods || []).forEach(period => {
        if (!periodStates[period.id]) {
          periodStates[period.id] = {
            id: period.id,
            metric_id: period.metric_id,
            reporting_date: period.reporting_date,
            expected: period.expected,
            target: period.target,
            complete: period.complete || 0,
            commentary: period.commentary || null,
            hasCreateEntry: false
          };
        }
      });
  
      // Second pass: Apply UPDATE/DELETE entries
      // For periods WITH CREATE entries: apply changes UP TO target date (forward replay)
      // For periods WITHOUT CREATE entries: reverse changes AFTER target date (backward replay)

      // Forward replay for periods with CREATE entries
      const auditLogsBeforeTarget = (allAuditLogs || []).filter(log =>
        new Date(log.created_at) <= targetDate
      );

      auditLogsBeforeTarget.forEach(log => {
        const recordId = log.record_id;

        if (log.action === 'CREATE') {
          return; // Already handled
        } else if (log.action === 'UPDATE') {
          if (periodStates[recordId] && periodStates[recordId].hasCreateEntry) {
            let newValues = {};
            try {
              newValues = JSON.parse(log.new_values || '{}');
            } catch (e) {
              console.error('Invalid JSON in new_values for audit log:', log.id);
              return;
            }
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

      // Backward replay for periods WITHOUT CREATE entries
      // Get updates AFTER target date in reverse order and apply old_values
      const auditLogsAfterTarget = (allAuditLogs || [])
        .filter(log => new Date(log.created_at) > targetDate)
        .reverse(); // Process in reverse chronological order

      auditLogsAfterTarget.forEach(log => {
        const recordId = log.record_id;

        if (log.action === 'UPDATE') {
          if (periodStates[recordId] && !periodStates[recordId].hasCreateEntry) {
            let oldValues = {};
            try {
              oldValues = JSON.parse(log.old_values || '{}');
            } catch (e) {
              console.error('Invalid JSON in old_values for audit log:', log.id);
              return;
            }

            // Restore old values (reversing the change)
            if (oldValues.complete !== undefined) {
              periodStates[recordId].complete = oldValues.complete;
            }
            if (oldValues.expected !== undefined) {
              periodStates[recordId].expected = oldValues.expected;
            }
            if (oldValues.target !== undefined) {
              periodStates[recordId].target = oldValues.target;
            }
            if (oldValues.commentary !== undefined) {
              periodStates[recordId].commentary = oldValues.commentary;
            }
          }
        }
      });

      // For periods without CREATE entries, reset complete/commentary if reporting_date is after target
      Object.values(periodStates).forEach(period => {
        if (!period.hasCreateEntry) {
          const periodReportingDate = new Date(period.reporting_date);
          if (periodReportingDate > targetDate) {
            period.complete = 0;
            period.commentary = null;
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
      (allAuditLogs || []).forEach(log => {
        if (log.action === 'CREATE') {
          const recordId = log.record_id;
          let newValues = {};
          try {
            newValues = JSON.parse(log.new_values || '{}');
          } catch (e) {
            console.error('Invalid JSON in new_values for audit log:', log.id);
            return;
          }
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
      (currentPeriods || []).forEach(period => {
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
      const relevantLogs = (allAuditLogs || []).filter(log =>
        new Date(log.created_at) <= targetDate
      );

      relevantLogs.forEach(log => {
        const recordId = log.record_id;

        if (log.action === 'CREATE') {
          return; // Already handled
        } else if (log.action === 'UPDATE') {
          if (periodStates[recordId]) {
            let newValues = {};
            try {
              newValues = JSON.parse(log.new_values || '{}');
            } catch (e) {
              console.error('Invalid JSON in new_values for audit log:', log.id);
              return;
            }
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
      await dbRun(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'pm'`);
      console.log('✅ Added role column to users table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Clean up invalid roles and convert to valid ones
    try {
      // Convert 'editor' to 'pm' (Project Manager is the closest equivalent)
      await dbRun(`UPDATE users SET role = 'pm' WHERE role = 'editor'`);
      // Convert 'viewer' to 'pm' (viewer role removed - all users can view everything)
      await dbRun(`UPDATE users SET role = 'pm' WHERE role = 'viewer'`);
      // Set any null or empty roles to 'pm'
      await dbRun(`UPDATE users SET role = 'pm' WHERE role IS NULL OR role = ''`);
      console.log('✅ Cleaned up user roles');
    } catch (err) {
      console.error('Error updating user roles:', err);
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

    // Migration: Add display_order column to metrics table for tab reordering
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN display_order INTEGER DEFAULT 0`);
      console.log('✅ Added display_order column to metrics table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add show_in_portfolio_review column to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN show_in_portfolio_review INTEGER DEFAULT 1`);
      console.log('✅ Added show_in_portfolio_review column to metrics table');

      // Set first 5 metrics per project to show in portfolio review
      await dbRun(`
        UPDATE metrics
        SET show_in_portfolio_review = CASE
          WHEN (
            SELECT COUNT(*)
            FROM metrics m2
            WHERE m2.project_id = metrics.project_id
            AND (m2.display_order < metrics.display_order OR (m2.display_order = metrics.display_order AND m2.id < metrics.id))
          ) < 5 THEN 1
          ELSE 0
        END
      `);
      console.log('✅ Set first 5 metrics per project to show in portfolio review');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add is_archived column to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN is_archived INTEGER DEFAULT 0`);
      console.log('✅ Added is_archived column to metrics table');
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

    // Migration: Add updated_at to projects table
    try {
      await dbRun(`ALTER TABLE projects ADD COLUMN updated_at DATETIME`);
      // Set default value for existing rows
      await dbRun(`UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL`);
      console.log('✅ Added updated_at column to projects table');
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

    // Migration: Add load_time_ms column to page_views
    try {
      await dbRun(`ALTER TABLE page_views ADD COLUMN load_time_ms INTEGER`);
      console.log('✅ Added load_time_ms column to page_views');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Create page_views summary tables for aggregation
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS page_views_daily_summary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          summary_date DATE NOT NULL UNIQUE,
          total_views INTEGER DEFAULT 0,
          avg_load_time REAL,
          min_load_time INTEGER,
          max_load_time INTEGER,
          views_with_timing INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_daily_summary_date ON page_views_daily_summary(summary_date)`);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS page_views_path_summary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          summary_date DATE NOT NULL,
          path TEXT NOT NULL,
          total_views INTEGER DEFAULT 0,
          avg_load_time REAL,
          min_load_time INTEGER,
          max_load_time INTEGER,
          views_with_timing INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(summary_date, path)
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_path_summary_date ON page_views_path_summary(summary_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_page_views_path_summary_path ON page_views_path_summary(path)`);
      console.log('✅ Created page_views summary tables');
    } catch (err) {
      // Tables already exist, that's fine
    }

    // Migration: Add p50 and p90 percentile columns to summary tables
    try {
      await dbRun(`ALTER TABLE page_views_daily_summary ADD COLUMN p50_load_time INTEGER`);
      console.log('✅ Added p50_load_time to page_views_daily_summary');
    } catch (err) {
      // Column already exists
    }
    try {
      await dbRun(`ALTER TABLE page_views_daily_summary ADD COLUMN p90_load_time INTEGER`);
      console.log('✅ Added p90_load_time to page_views_daily_summary');
    } catch (err) {
      // Column already exists
    }
    try {
      await dbRun(`ALTER TABLE page_views_path_summary ADD COLUMN p50_load_time INTEGER`);
      console.log('✅ Added p50_load_time to page_views_path_summary');
    } catch (err) {
      // Column already exists
    }
    try {
      await dbRun(`ALTER TABLE page_views_path_summary ADD COLUMN p90_load_time INTEGER`);
      console.log('✅ Added p90_load_time to page_views_path_summary');
    } catch (err) {
      // Column already exists
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

    // Migration: Create spaces table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS spaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT DEFAULT '#6366f1',
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created spaces table');
    } catch (err) {
      console.error('Error creating spaces table:', err);
    }

    // Migration: Add space_id to portfolios table
    try {
      await dbRun(`ALTER TABLE portfolios ADD COLUMN space_id INTEGER REFERENCES spaces(id) ON DELETE SET NULL`);
      console.log('✅ Added space_id column to portfolios table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add manager_id to portfolios table
    try {
      await dbRun(`ALTER TABLE portfolios ADD COLUMN manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
      console.log('✅ Added manager_id column to portfolios table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Add default_space_id to users table
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN default_space_id INTEGER REFERENCES spaces(id) ON DELETE SET NULL`);
      console.log('✅ Added default_space_id column to users table');
    } catch (err) {
      // Column already exists, that's fine
    }

    // Migration: Create index for space_id in portfolios
    try {
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_portfolios_space ON portfolios(space_id)`);
      console.log('✅ Created index for space_id in portfolios');
    } catch (err) {
      // Index already exists, that's fine
    }

    // Migration: Create space_admin_assignments table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS space_admin_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          space_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE(user_id, space_id)
        )
      `);
      console.log('✅ Created space_admin_assignments table');
    } catch (err) {
      // Table already exists, that's fine
    }

    // Migration: Create indexes for space_admin_assignments
    try {
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_space_admin_user ON space_admin_assignments(user_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_space_admin_space ON space_admin_assignments(space_id)`);
      console.log('✅ Created indexes for space_admin_assignments');
    } catch (err) {
      // Indexes already exist, that's fine
    }

    // Migration: Insert default space if none exists
    try {
      const existingSpaces = await dbAll('SELECT id FROM spaces');
      if (existingSpaces.length === 0) {
        await dbRun(
          `INSERT INTO spaces (id, name, description, color, icon, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [1, 'Default Space', 'Default space for all portfolios', '#6366f1', 'circle', 0]
        );
        console.log('✅ Created default space');
      }
    } catch (err) {
      // Space already exists, that's fine
    }

    // Migration: Create project_dependencies table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS project_dependencies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          depends_on_project_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (depends_on_project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE(project_id, depends_on_project_id)
        )
      `);
      console.log('✅ Created project_dependencies table');
    } catch (err) {
      // Table already exists or other error
    }

    // Migration: Create index for project_dependencies
    try {
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_dependencies_project ON project_dependencies(project_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_dependencies_depends_on ON project_dependencies(depends_on_project_id)`);
      console.log('✅ Created indexes for project_dependencies');
    } catch (err) {
      // Indexes already exist, that's fine
    }

    // Migration: Create milestones table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          target_date DATE NOT NULL,
          completed INTEGER DEFAULT 0,
          completed_date DATE,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created milestones table');
    } catch (err) {
      // Table already exists, that's fine
    }

    // Migration: Create index for milestones
    try {
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id)`);
      console.log('✅ Created index for milestones');
    } catch (err) {
      // Index already exists, that's fine
    }

    // Migration: Create project_comments table
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS project_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          comment_text TEXT NOT NULL,
          created_by INTEGER,
          creator_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Created project_comments table');
    } catch (err) {
      // Table already exists, that's fine
    }

    // Migration: Create index for project_comments
    try {
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_comments_created ON project_comments(created_at DESC)`);
      console.log('✅ Created indexes for project_comments');
    } catch (err) {
      // Indexes already exist, that's fine
    }

    // Migration: Add creator_name column to project_comments if missing
    try {
      // Check if column exists
      const tableInfo = await dbAll(`PRAGMA table_info(project_comments)`);
      const hasCreatorName = tableInfo.some(col => col.name === 'creator_name');

      if (!hasCreatorName) {
        await dbRun(`ALTER TABLE project_comments ADD COLUMN creator_name TEXT`);
        console.log('✅ Added creator_name column to project_comments');
      }
    } catch (err) {
      // Column already exists or other error
    }

    // Migration: Populate project_comments for Illustrative Examples projects
    try {
      // Get all Illustrative Examples projects that don't have comments
      const illustrativeProjects = await dbAll(`
        SELECT p.id, p.name
        FROM projects p
        INNER JOIN portfolios port ON p.portfolio_id = port.id
        WHERE port.name = 'Illustrative Examples'
        AND NOT EXISTS (
          SELECT 1 FROM project_comments pc WHERE pc.project_id = p.id
        )
      `);

      if (illustrativeProjects.length > 0) {
        // Get admin user
        const admin = await dbGet('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
        const adminId = admin?.id || 1;

        // Helper to get date strings relative to today
        const getDateTime = (daysOffset) => {
          const date = new Date();
          date.setDate(date.getDate() + daysOffset);
          return date.toISOString();
        };

        for (const project of illustrativeProjects) {
          // Add 2 comments per project
          await dbRun(`
            INSERT INTO project_comments (project_id, comment_text, created_by, creator_name, created_at)
            VALUES (?, ?, ?, ?, ?)
          `, [
            project.id,
            `<p><strong>Latest Update:</strong> ${project.name} project is progressing well. Team collaboration has been excellent and stakeholders are engaged.</p><p>Key achievements this period include successful milestone completion and positive feedback from early users.</p>`,
            adminId,
            'Admin User',
            getDateTime(-2)
          ]);

          await dbRun(`
            INSERT INTO project_comments (project_id, comment_text, created_by, creator_name, created_at)
            VALUES (?, ?, ?, ?, ?)
          `, [
            project.id,
            `<p>Previous update: Initial planning phase completed. Resources allocated and timeline confirmed with all stakeholders.</p>`,
            adminId,
            'Admin User',
            getDateTime(-14)
          ]);
        }
        console.log(`✅ Added project comments for ${illustrativeProjects.length} Illustrative Examples projects`);
      }
    } catch (err) {
      console.log('ℹ️  Project comments migration skipped or failed:', err.message);
    }

    // Migration: Add performance indexes for common queries
    try {
      // Existing indexes
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_projects_portfolio ON projects(portfolio_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(record_id)`);

      // New performance indexes
      // Users - frequently queried by email and name
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)`);

      // Metric Periods - very frequently ordered by reporting_date
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metric_periods_reporting_date ON metric_periods(reporting_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metric_periods_metric_date ON metric_periods(metric_id, reporting_date)`);

      // Comments - ordered by timestamps for recent commentary
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_comments_updated_at ON comments(updated_at DESC)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_comments_created_by ON comments(created_by)`);

      // CRAIDs - filtered by type and status
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_type ON craids(type)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_status ON craids(status)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_project_type ON craids(project_id, type)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_project_status ON craids(project_id, status)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_created_by ON craids(created_by)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_craids_owner ON craids(owner_id)`);

      // Milestones - ordered by target_date
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_milestones_project_date ON milestones(project_id, target_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_milestones_completed ON milestones(completed)`);

      // Spaces - ordered by display_order and name
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_spaces_display_order ON spaces(display_order)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_spaces_name ON spaces(name)`);

      // Portfolios - ordered by display_order and name
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_portfolios_display_order ON portfolios(display_order)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_portfolios_name ON portfolios(name)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_portfolios_space ON portfolios(space_id)`);

      // Projects - add indexes for commonly used fields
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date)`);

      // Metrics - add indexes for owner and dates
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metrics_start_date ON metrics(start_date)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metrics_end_date ON metrics(end_date)`);

      // Audit log - composite indexes for complex queries
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_audit_log_table_date ON audit_log(table_name, created_at DESC)`);

      console.log('✅ Created performance indexes');
    } catch (err) {
      // Indexes already exist, that's fine
    }

    // Migration: Add parent_comment_id for threaded comments (backward compatible - nullable)
    try {
      // Add to period-level comments table
      const commentsInfo = await dbAll(`PRAGMA table_info(comments)`);
      const commentsHasParent = commentsInfo.some(col => col.name === 'parent_comment_id');

      if (!commentsHasParent) {
        await dbRun(`ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)`);
        console.log('✅ Added parent_comment_id column to comments table for threading');
      }

      // Add to project-level comments table
      const projectCommentsInfo = await dbAll(`PRAGMA table_info(project_comments)`);
      const projectCommentsHasParent = projectCommentsInfo.some(col => col.name === 'parent_comment_id');

      if (!projectCommentsHasParent) {
        await dbRun(`ALTER TABLE project_comments ADD COLUMN parent_comment_id INTEGER REFERENCES project_comments(id) ON DELETE CASCADE`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_project_comments_parent ON project_comments(parent_comment_id)`);
        console.log('✅ Added parent_comment_id column to project_comments table for threading');
      }
    } catch (err) {
      console.log('ℹ️  Thread columns migration skipped or failed:', err.message);
    }

    // Migration: Add is_system_admin column to users table
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN is_system_admin INTEGER DEFAULT 0`);
      console.log('✅ Added is_system_admin column to users table');
    } catch (err) {
      // Column likely already exists
      if (!err.message.includes('duplicate column')) {
        console.log('ℹ️  is_system_admin migration skipped:', err.message);
      }
    }

    // Create default system admin if none exists
    const existingSystemAdmin = await dbGet('SELECT id FROM users WHERE is_system_admin = 1');
    if (!existingSystemAdmin) {
      const hash = await hashPassword('admin123');
      await dbRun('INSERT INTO users (email, name, password_hash, role, is_system_admin) VALUES (?, ?, ?, ?, ?)',
        ['sysadmin@example.com', 'System Admin', hash, 'admin', 1]);
      console.log('✅ Created default system admin: sysadmin@example.com / admin123');
    }

    // Migration: Create space_admin_assignments table
    try {
      await dbRun(`CREATE TABLE IF NOT EXISTS space_admin_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        space_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(user_id, space_id)
      )`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_space_admin_user ON space_admin_assignments(user_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_space_admin_space ON space_admin_assignments(space_id)`);
      console.log('✅ Created space_admin_assignments table');
    } catch (err) {
      console.log('ℹ️  space_admin_assignments migration skipped:', err.message);
    }

    // Migration: Create metric_dimensions table
    try {
      await dbRun(`CREATE TABLE IF NOT EXISTS metric_dimensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
        UNIQUE(metric_id, name)
      )`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_metric_dimensions_metric ON metric_dimensions(metric_id)`);
      console.log('✅ Created metric_dimensions table');
    } catch (err) {
      console.log('ℹ️  metric_dimensions migration skipped:', err.message);
    }

    // Migration: Create metric_period_dimension_values table
    try {
      await dbRun(`CREATE TABLE IF NOT EXISTS metric_period_dimension_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id INTEGER NOT NULL,
        dimension_id INTEGER NOT NULL,
        value REAL NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (period_id) REFERENCES metric_periods(id) ON DELETE CASCADE,
        FOREIGN KEY (dimension_id) REFERENCES metric_dimensions(id) ON DELETE CASCADE,
        UNIQUE(period_id, dimension_id)
      )`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_dimension_values_period ON metric_period_dimension_values(period_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_dimension_values_dimension ON metric_period_dimension_values(dimension_id)`);
      console.log('✅ Created metric_period_dimension_values table');
    } catch (err) {
      console.log('ℹ️  metric_period_dimension_values migration skipped:', err.message);
    }

    // Migration: Add has_dimensions column to metrics table
    try {
      await dbRun(`ALTER TABLE metrics ADD COLUMN has_dimensions INTEGER DEFAULT 0`);
      console.log('✅ Added has_dimensions column to metrics');
    } catch (err) {
      // Column likely already exists
    }

    // Migration: Create backlog_items table for project ideas
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS backlog_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE SET NULL,
          initiative_manager TEXT,
          priority TEXT DEFAULT 'medium',
          start_date DATE,
          end_date DATE,
          created_by INTEGER REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_backlog_portfolio ON backlog_items(portfolio_id)`);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority)`);
      console.log('✅ Created backlog_items table');
    } catch (err) {
      // Table likely already exists
    }

    // Migration: Add start_date and end_date to backlog_items
    try {
      await dbRun(`ALTER TABLE backlog_items ADD COLUMN start_date DATE`);
      console.log('✅ Added start_date column to backlog_items');
    } catch (err) {
      // Column likely already exists
    }
    try {
      await dbRun(`ALTER TABLE backlog_items ADD COLUMN end_date DATE`);
      console.log('✅ Added end_date column to backlog_items');
    } catch (err) {
      // Column likely already exists
    }

    // Create default admin user if none exists
    const existingAdmin = await dbGet('SELECT id FROM users WHERE email = ? OR name = ?', ['admin@example.com', 'Admin User']);
    if (!existingAdmin) {
      const hash = await hashPassword('admin123');
      await dbRun('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', ['admin@example.com', 'Admin User', hash, 'admin']);
      console.log('✅ Created default admin user: admin@example.com / admin123');
    }

    // Seed Illustrative Examples Portfolio (if not exists)
    try {
      const { seedIllustrativeExamples } = require('./seed-illustrative-examples');
      await seedIllustrativeExamples();
    } catch (err) {
      console.log('ℹ️  Illustrative examples seed skipped or failed:', err.message);
    }

    console.log('✅ Database ready at backend/data/progress-tracker.db');
  }

  // Run migrations immediately
  runMigrations().catch(err => {
    console.error('Error running migrations:', err);
  });

  // Return app and database functions for use (server start moved outside)
  return { app, PORT, dbRun, dbGet, dbAll, generateConsistencyFeedback, db };
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

    // Start the page_views aggregation job
    const { schedulePageViewsAggregation } = require('./jobs/page-views-aggregation');
    const retentionDays = parseInt(process.env.PAGE_VIEWS_RETENTION_DAYS) || 30;
    const schedule = process.env.PAGE_VIEWS_AGGREGATION_SCHEDULE || '0 2 * * *'; // 2 AM daily by default

    schedulePageViewsAggregation(defaultInstance.db, schedule, retentionDays);
  });
}

// Export app for testing (backward compatibility)
module.exports = app;
// Export createApp for test isolation
module.exports.createApp = createApp;
