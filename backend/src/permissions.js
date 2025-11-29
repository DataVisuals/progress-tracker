const { dbGet, dbAll } = require('./db');

// Role constants
const ROLES = {
  ADMIN: 'admin',
  PM: 'pm',
  EDITOR: 'editor' // Legacy role - treat as PM
};

// Check if user is a system admin (cross-space/global permissions)
async function isSystemAdmin(userId) {
  const user = await dbGet('SELECT is_system_admin FROM users WHERE id = ?', [userId]);
  return user && user.is_system_admin === 1;
}

// Check if user is a system admin (sync version for use with user object)
function isSystemAdminSync(user) {
  return user && user.is_system_admin === 1;
}

// Check if user can edit a project
async function canEditProject(userId, projectId) {
  const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

  // System admins can edit anything across all spaces
  if (user.is_system_admin === 1) {
    return true;
  }

  // Regular admins can edit anything (will be space-scoped later)
  if (user.role === ROLES.ADMIN) {
    return true;
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

// Get all projects user can view (everyone can view all projects)
async function getViewableProjects(userId) {
  return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
}

// Get all projects user can edit
async function getEditableProjects(userId) {
  const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

  // System admins can edit all projects across all spaces
  if (user.is_system_admin === 1) {
    return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
  }

  // Regular admins can edit all projects (will be space-scoped later)
  if (user.role === ROLES.ADMIN) {
    return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
  }

  // PMs and Editors can edit projects they have permission for
  if (user.role === ROLES.PM || user.role === ROLES.EDITOR) {
    return await dbAll(`
      SELECT p.* FROM projects p
      INNER JOIN project_permissions pp ON p.id = pp.project_id
      WHERE pp.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);
  }

  // Default: no editable projects
  return [];
}

module.exports = {
  ROLES,
  canEditProject,
  canCreateProject,
  isAdmin,
  isSystemAdmin,
  isSystemAdminSync,
  getViewableProjects,
  getEditableProjects
};
