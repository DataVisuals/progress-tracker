const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, dbRun, dbGet, dbAll, generateMetricPeriods } = require('./db');
const { ROLES, canEditProject, canCreateProject, isAdmin } = require('./permissions');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// ===== AUTH MIDDLEWARE =====
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
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

// ===== AUTH ROUTES =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
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
    res.status(400).json({ error: 'User already exists' });
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
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = bcrypt.hashSync(newPassword, 10);

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

// ===== PROJECTS =====
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user can create projects (using role from JWT token)
    if (!canCreateProject(req.user)) {
      return res.status(403).json({ error: 'You do not have permission to create projects' });
    }

    const { name, description, initiative_manager } = req.body;
    const result = await dbRun(
      'INSERT INTO projects (name, description, initiative_manager) VALUES (?, ?, ?)',
      [name, description, initiative_manager || null]
    );

    // Auto-grant permission to the creating user if they are a PM
    if (req.user.role === ROLES.PM) {
      await dbRun(
        'INSERT INTO project_permissions (project_id, user_id) VALUES (?, ?)',
        [result.lastID, req.user.userId]
      );
    }

    await logAudit(req.user, 'CREATE', 'projects', result.lastID, null,
      { name, description, initiative_manager },
      `Created project "${name}"`,
      req.ip
    );

    res.json({ id: result.lastID, name, description, initiative_manager });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user can edit this project
    if (!(await canEditProject(req.user.userId, req.params.id))) {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
    }

    const { name, description, initiative_manager } = req.body;
    const oldProject = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);

    await dbRun(
      'UPDATE projects SET name = ?, description = ?, initiative_manager = ? WHERE id = ?',
      [name, description, initiative_manager || null, req.params.id]
    );

    await logAudit(req.user, 'UPDATE', 'projects', req.params.id,
      { name: oldProject.name, description: oldProject.description, initiative_manager: oldProject.initiative_manager },
      { name, description, initiative_manager },
      `Renamed project from "${oldProject.name}" to "${name}"`,
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
    await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);

    await logAudit(req.user, 'DELETE', 'projects', req.params.id,
      { name: oldProject.name, description: oldProject.description },
      null,
      `Deleted project "${oldProject.name}"`,
      req.ip
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    res.json({ success: true, id: result.lastID });
  } catch (err) {
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

    const { name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance } = req.body;

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
      owner_id: finalOwnerId,
      start_date,
      end_date,
      frequency,
      progression_type,
      final_target
    });

    const result = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.projectId, name, finalOwnerId, start_date, end_date, frequency, progression_type || 'linear', final_target, amber_tolerance || 5.0, red_tolerance || 10.0]);

    console.log('Metric created with ID:', result.lastID);

    // Auto-generate periods
    console.log('Generating periods...');
    await generateMetricPeriods(result.lastID, start_date, end_date, frequency, progression_type || 'linear', final_target);

    console.log('Periods generated successfully');

    await logAudit(req.user, 'CREATE', 'metrics', result.lastID, null,
      { name, owner_id: finalOwnerId, start_date, end_date, frequency, progression_type: progression_type || 'linear', final_target },
      `Created metric "${name}" for project ID ${req.params.projectId}`,
      req.ip
    );

    res.json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating metric:', err);
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
    const { name, amber_tolerance, red_tolerance, final_target, progression_type } = req.body;

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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await dbRun(`UPDATE metrics SET ${updates.join(', ')} WHERE id = ?`, values);

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

// ===== PROJECT DATA (for grid view) =====
app.get('/api/projects/:projectId/data', async (req, res) => {
  try {
    const data = await dbAll(`
      SELECT
        mp.id,
        mp.reporting_date,
        m.name as metric,
        mp.expected,
        mp.target as final_target,
        mp.complete,
        mp.commentary,
        m.id as metric_id,
        m.amber_tolerance,
        m.red_tolerance,
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

    // Only admins can make historic edits
    if (isHistoricEdit) {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({
          error: 'Historic edits of completion values are restricted to administrators only',
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

    const { complete } = req.body;

    // Check if this is a historic edit of completion values (period end date has passed)
    const periodEndDate = new Date(periodData.reporting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isHistoricEdit = periodEndDate < today && complete !== undefined;

    // Only admins can make historic edits
    if (isHistoricEdit) {
      const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
      if (!isAdmin(user)) {
        return res.status(403).json({
          error: 'Historic edits of completion values are restricted to administrators only',
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
      [req.params.periodId, comment_text, req.user.id]
    );

    await logAudit(req.user, 'CREATE', 'comments', result.lastID, null,
      { period_id: req.params.periodId, comment_text },
      `Added comment to period ID ${req.params.periodId}`,
      req.ip
    );

    res.json({ id: result.lastID });
  } catch (err) {
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

    res.json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating CRAID:', err);
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
// Get all users (Admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.role) {
      return res.status(500).json({ error: 'User role not set. Please restart the server to run migrations.' });
    }

    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Only admins can view users' });
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

    // Check if target user exists and is a PM
    const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.role !== 'pm') {
      return res.status(400).json({ error: 'Can only grant permissions to PM users' });
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

    res.json({ success: true });
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
    const { limit = 100, offset = 0, table_name, user_id, action } = req.query;

    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

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

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await dbAll(query, params);
    res.json(logs);
  } catch (err) {
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
            SELECT m.name, m.project_id, m.amber_tolerance, m.red_tolerance, p.name as initiative, p.initiative_manager
            FROM metrics m
            JOIN projects p ON m.project_id = p.id
            WHERE m.id = ?
          `, [period.metric_id]);

          const owner = await dbGet('SELECT name FROM users WHERE id = (SELECT owner_id FROM metrics WHERE id = ?)', [period.metric_id]);

          return {
            id: period.id,
            reporting_date: period.reporting_date,
            metric: metric?.name || 'Unknown',
            expected: period.expected,
            target: period.target,
            final_target: period.target, // Use target as final_target for consistency
            complete: period.complete,
            commentary: period.commentary,
            metric_id: period.metric_id,
            amber_tolerance: metric?.amber_tolerance || 5.0,
            red_tolerance: metric?.red_tolerance || 10.0,
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

// ===== EXPORT =====
const { exportAllData } = require('./exportService');

// Manual export trigger (admin only)
app.post('/api/export', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Only admins can trigger exports' });
    }

    const filepath = await exportAllData();
    const filename = require('path').basename(filepath);

    res.json({
      message: 'Export completed successfully',
      filename: filename
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== SERVER START =====
app.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

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

  // Migration: Add tolerance columns to metrics table
  try {
    await dbRun(`ALTER TABLE metrics ADD COLUMN amber_tolerance REAL DEFAULT 5.0`);
    await dbRun(`ALTER TABLE metrics ADD COLUMN red_tolerance REAL DEFAULT 10.0`);
    console.log('✅ Added tolerance columns to metrics table');
  } catch (err) {
    // Columns already exist, that's fine
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

  // Create default admin user if none exists
  const result = await dbGet('SELECT COUNT(*) as count FROM users');
  if (result.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await dbRun('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', ['admin@example.com', 'Admin User', hash, 'admin']);
    console.log('✅ Created default admin user: admin@example.com / admin123');
  }

  console.log('✅ Database ready at backend/data/progress-tracker.db');

  // Start the daily export scheduler
  startScheduler();
});
