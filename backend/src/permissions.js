const { dbGet, dbAll, dbRun } = require('./db');

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

// Get all projects user can view (everyone can view all projects)
async function getViewableProjects(userId) {
  return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
}

// Get all projects user can edit (space-scoped for admins)
async function getEditableProjects(userId) {
  const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

  // System admins can edit all projects across all spaces
  if (user.is_system_admin === 1) {
    return await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
  }

  // Regular admins: only projects in their assigned spaces
  if (user.role === ROLES.ADMIN) {
    const adminSpaces = await getAdminSpaces(userId);

    if (adminSpaces.length === 0) {
      // Admin has no space assignments - can only edit unassigned projects
      return await dbAll(`
        SELECT pr.* FROM projects pr
        LEFT JOIN portfolios p ON pr.portfolio_id = p.id
        WHERE p.space_id IS NULL OR p.id IS NULL
        ORDER BY pr.created_at DESC
      `);
    }

    const spaceIds = adminSpaces.map(s => s.id);
    const placeholders = spaceIds.map(() => '?').join(',');

    return await dbAll(`
      SELECT pr.* FROM projects pr
      LEFT JOIN portfolios p ON pr.portfolio_id = p.id
      WHERE p.space_id IN (${placeholders}) OR p.space_id IS NULL OR p.id IS NULL
      ORDER BY pr.created_at DESC
    `, spaceIds);
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

// Check if user can delete a project (same as edit, but explicit for clarity)
async function canDeleteProject(userId, projectId) {
  return await canEditProject(userId, projectId);
}

// Check if admin can manage users in a space
async function canManageSpaceUsers(userId, spaceId) {
  const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

  if (!user || user.role !== ROLES.ADMIN) {
    return false;
  }

  // System admins can manage users in any space
  if (user.is_system_admin === 1) {
    return true;
  }

  // Regular admins can only manage users if they're assigned to the space
  return await isAdminForSpace(userId, spaceId);
}

// Check if admin can manage a portfolio (via space)
async function canManagePortfolio(userId, portfolioId) {
  const user = await dbGet('SELECT role, is_system_admin FROM users WHERE id = ?', [userId]);

  if (!user || user.role !== ROLES.ADMIN) {
    return false;
  }

  if (user.is_system_admin === 1) {
    return true;
  }

  const portfolio = await dbGet('SELECT space_id FROM portfolios WHERE id = ?', [portfolioId]);

  if (!portfolio || !portfolio.space_id) {
    // Unassigned portfolio - admin can manage
    return true;
  }

  return await isAdminForSpace(userId, portfolio.space_id);
}

// Get all space admin assignments for a user
async function getSpaceAdminAssignments(userId) {
  return await dbAll(`
    SELECT sa.*, s.name as space_name
    FROM space_admin_assignments sa
    JOIN spaces s ON sa.space_id = s.id
    WHERE sa.user_id = ?
    ORDER BY s.display_order
  `, [userId]);
}

// Assign admin to space
async function assignAdminToSpace(userId, spaceId, createdBy) {
  try {
    await dbRun(
      'INSERT INTO space_admin_assignments (user_id, space_id, created_by) VALUES (?, ?, ?)',
      [userId, spaceId, createdBy]
    );
    return true;
  } catch (error) {
    // Unique constraint violation means already assigned
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return false;
    }
    throw error;
  }
}

// Remove admin from space
async function removeAdminFromSpace(userId, spaceId) {
  const result = await dbRun(
    'DELETE FROM space_admin_assignments WHERE user_id = ? AND space_id = ?',
    [userId, spaceId]
  );
  return result && result.changes > 0;
}

module.exports = {
  ROLES,
  canEditProject,
  canDeleteProject,
  canCreateProject,
  isAdmin,
  isSystemAdmin,
  isSystemAdminSync,
  isAdminForSpace,
  getAdminSpaces,
  getProjectSpaceId,
  getViewableProjects,
  getEditableProjects,
  canManageSpaceUsers,
  canManagePortfolio,
  getSpaceAdminAssignments,
  assignAdminToSpace,
  removeAdminFromSpace
};
