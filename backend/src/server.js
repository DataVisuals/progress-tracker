const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, dbRun, dbGet, dbAll, generateMetricPeriods } = require('./db');

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

// ===== AUTH ROUTES =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const result = await dbRun('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)', [email, name, hash]);
    res.json({ id: result.lastID, email, name });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

// ===== PROJECTS =====
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { name, description, initiative_manager } = req.body;
    const result = await dbRun(
      'INSERT INTO projects (name, description, initiative_manager) VALUES (?, ?, ?)',
      [name, description, initiative_manager || null]
    );
    res.json({ id: result.lastID, name, description, initiative_manager });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== METRICS =====
app.get('/api/projects/:projectId/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = await dbAll('SELECT * FROM metrics WHERE project_id = ?', [req.params.projectId]);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:projectId/metrics', authenticateToken, async (req, res) => {
  try {
    const { name, owner_id, start_date, end_date, frequency, progression_type, final_target } = req.body;

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
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.projectId, name, finalOwnerId, start_date, end_date, frequency, progression_type || 'linear', final_target]);

    console.log('Metric created with ID:', result.lastID);

    // Auto-generate periods
    console.log('Generating periods...');
    await generateMetricPeriods(result.lastID, start_date, end_date, frequency, progression_type || 'linear', final_target);

    console.log('Periods generated successfully');

    res.json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating metric:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    await dbRun('UPDATE metrics SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM metrics WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PROJECT DATA (for grid view) =====
app.get('/api/projects/:projectId/data', authenticateToken, async (req, res) => {
  try {
    const data = await dbAll(`
      SELECT
        mp.id,
        mp.reporting_date,
        m.name as metric,
        mp.expected,
        mp.target as final_target,
        mp.complete,
        m.id as metric_id,
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
app.get('/api/metrics/:metricId/periods', authenticateToken, async (req, res) => {
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
    const result = await dbRun(
      'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
      [metric_id, reporting_date, expected, target, complete || 0]
    );
    res.json({ id: result.lastID, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/metric-periods/:id', authenticateToken, async (req, res) => {
  try {
    const { complete, expected, target } = req.body;
    const updates = [];
    const params = [];

    if (complete !== undefined) {
      updates.push('complete = ?');
      params.push(complete);
    }
    if (expected !== undefined) {
      updates.push('expected = ?');
      params.push(expected);
    }
    if (target !== undefined) {
      updates.push('target = ?');
      params.push(target);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await dbRun(`UPDATE metric_periods SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/metric-periods/:id', authenticateToken, async (req, res) => {
  try {
    const { complete } = req.body;
    if (complete !== undefined) {
      await dbRun('UPDATE metric_periods SET complete = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [complete, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COMMENTS (for periods) =====
app.get('/api/periods/:periodId/comments', authenticateToken, async (req, res) => {
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
    const { comment_text } = req.body;
    const result = await dbRun(
      'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
      [req.params.periodId, comment_text, req.user.id]
    );
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CRAIDs (Comments, Risks, Actions, Issues, Dependencies) =====
app.get('/api/projects/:projectId/craids', authenticateToken, async (req, res) => {
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
    res.json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating CRAID:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/craids/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, owner_id } = req.body;
    await dbRun(`
      UPDATE craids
      SET title = ?, description = ?, status = ?, priority = ?, owner_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, description, status, priority, owner_id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/craids/:id', authenticateToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM craids WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SERVER START =====
app.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

  // Create default admin user if none exists
  const result = await dbGet('SELECT COUNT(*) as count FROM users');
  if (result.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await dbRun('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', ['admin@example.com', 'Admin User', hash, 'admin']);
    console.log('✅ Created default admin user: admin@example.com / admin123');
  }

  console.log('✅ Database ready at backend/data/progress-tracker.db');
});
