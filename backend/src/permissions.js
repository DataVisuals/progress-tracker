const { dbGet, dbAll } = require('./db');

// Role constants
const ROLES = {
  ADMIN: 'admin',
  PM: 'pm',
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

  // PMs can edit if they have permission
  if (user.role === ROLES.PM) {
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
  return user.role === ROLES.ADMIN || user.role === ROLES.PM;
}

// Check if user is admin
function isAdmin(user) {
  return user.role === ROLES.ADMIN;
}

// Get all projects user can view (everyone can view all projects)
async function getViewableProjects(userId) {
  return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
}

// Get all projects user can edit
async function getEditableProjects(userId) {
  const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);

  // Admins can edit all projects
  if (user.role === ROLES.ADMIN) {
    return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
  }

  // PMs can edit projects they have permission for
  if (user.role === ROLES.PM) {
    return await dbAll(`
      SELECT p.* FROM projects p
      INNER JOIN project_permissions pp ON p.id = pp.project_id
      WHERE pp.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);
  }

  // Viewers can't edit any projects
  return [];
}

module.exports = {
  ROLES,
  canEditProject,
  canCreateProject,
  isAdmin,
  getViewableProjects,
  getEditableProjects
};
