import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { MdContentCopy, MdSearch } from 'react-icons/md';
import { api } from '../api/client';
import { selectStyles, compactSelectStyles } from './SelectStyles';
import './FormInputs.css';
import './UserManagement.css';

const UserManagement = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'pm'
  });
  const [nameError, setNameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);
  const [showEmailsList, setShowEmailsList] = useState(false);
  const [emailFormat, setEmailFormat] = useState('newline'); // 'newline', 'comma', 'semicolon'
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [editingField, setEditingField] = useState(null); // { userId, field: 'name' | 'email' }
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
      alert('Failed to load users: ' + err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadUserPermissions = async (userId) => {
    try {
      const permissions = [];
      for (const project of projects) {
        try {
          const response = await api.getProjectPermissions(project.id);
          const hasPermission = response.data.some(p => p.user_id === userId);
          if (hasPermission) {
            permissions.push(project);
          }
        } catch (err) {
          // User might not have access to view some project permissions
          console.log(`Cannot check permissions for project ${project.id}`);
        }
      }
      setUserPermissions(permissions);
    } catch (err) {
      console.error('Failed to load user permissions:', err);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (user.role === 'pm') {
      loadUserPermissions(user.id);
    } else {
      setUserPermissions([]);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    try {
      await api.updateUserRole(userId, newRole);
      await loadUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
        if (newRole === 'pm') {
          loadUserPermissions(userId);
        } else {
          setUserPermissions([]);
        }
      }
      alert('User role updated successfully');
    } catch (err) {
      console.error('Failed to update user role:', err);
      alert('Failed to update user role: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteUser(userId);
      await loadUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(null);
        setUserPermissions([]);
      }
      alert('User deleted successfully');
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user: ' + (err.response?.data?.error || err.message));
    }
  };

  const startEditing = (userId, field, currentValue) => {
    setEditingField({ userId, field });
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField || !editValue.trim()) {
      cancelEditing();
      return;
    }

    const user = users.find(u => u.id === editingField.userId);
    if (!user) {
      cancelEditing();
      return;
    }

    // No change made
    if (editValue.trim() === user[editingField.field]) {
      cancelEditing();
      return;
    }

    try {
      await api.updateUser(editingField.userId, { [editingField.field]: editValue.trim() });
      await loadUsers();
      // Update selectedUser if it was the one being edited
      if (selectedUser && selectedUser.id === editingField.userId) {
        setSelectedUser({ ...selectedUser, [editingField.field]: editValue.trim() });
      }
      cancelEditing();
    } catch (err) {
      console.error('Failed to update user:', err);
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleGrantPermission = async (projectId) => {
    if (!selectedUser) return;

    try {
      await api.grantProjectPermission(projectId, selectedUser.id);
      await loadUserPermissions(selectedUser.id);
      alert('Permission granted successfully');
    } catch (err) {
      console.error('Failed to grant permission:', err);
      alert('Failed to grant permission: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRevokePermission = async (projectId) => {
    if (!selectedUser) return;

    if (!confirm('Are you sure you want to revoke this permission?')) {
      return;
    }

    try {
      await api.revokeProjectPermission(projectId, selectedUser.id);
      await loadUserPermissions(selectedUser.id);
      alert('Permission revoked successfully');
    } catch (err) {
      console.error('Failed to revoke permission:', err);
      alert('Failed to revoke permission: ' + (err.response?.data?.error || err.message));
    }
  };

  const checkNameAvailability = async (name) => {
    if (!name || name.trim().length < 2) {
      setNameError('');
      return;
    }

    setCheckingName(true);
    try {
      const response = await api.checkNameAvailability(name.trim());
      if (!response.data.available) {
        setNameError(response.data.message);
      } else {
        setNameError('');
      }
    } catch (err) {
      console.error('Error checking name:', err);
    } finally {
      setCheckingName(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) {
      alert('Please fill in all fields');
      return;
    }

    if (nameError) {
      alert('Please choose a different name - this one is already taken.');
      return;
    }

    try {
      await api.register(newUser.email, newUser.name, newUser.password);

      // Now update the role if it's not the default
      const usersResponse = await api.getUsers();
      const createdUser = usersResponse.data.find(u => u.email === newUser.email);

      if (createdUser && newUser.role !== 'pm') {
        await api.updateUserRole(createdUser.id, newUser.role);
      }

      setNewUser({ email: '', name: '', password: '', role: 'pm' });
      setShowAddUser(false);
      await loadUsers();
      alert('User created successfully');
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('Failed to create user: ' + (err.response?.data?.error || err.message));
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'role-badge-admin';
      case 'pm': return 'role-badge-pm';
      default: return '';
    }
  };

  // Sort and filter users
  const sortedFilteredUsers = useMemo(() => {
    let filtered = users;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = users.filter(u =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      );
    }
    return [...filtered].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [users, searchQuery]);

  // Sort projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [projects]);

  // Sort user permissions alphabetically
  const sortedUserPermissions = useMemo(() => {
    return [...userPermissions].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [userPermissions]);

  const availableProjects = sortedProjects.filter(
    p => !userPermissions.some(up => up.id === p.id)
  );

  // Filter available projects by search query
  const filteredAvailableProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return availableProjects;
    const query = projectSearchQuery.toLowerCase();
    return availableProjects.filter(p =>
      p.name?.toLowerCase().includes(query)
    );
  }, [availableProjects, projectSearchQuery]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-management-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>User Management</h2>

        <div className="user-management-container">
          <div className="users-list">
            <div className="users-list-header">
              <h3>Users ({sortedFilteredUsers.length}{searchQuery ? ` of ${users.length}` : ''}) <span className="select-hint">Click row to manage permissions</span></h3>
              <div className="users-list-actions">
                <div className="users-search-box">
                  <MdSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="users-search-input"
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  className="copy-emails-btn"
                  onClick={() => setShowEmailsList(true)}
                  title="Get all user emails as semicolon-separated list"
                >
                  <MdContentCopy />
                  Emails
                </button>
                <button className="add-user-btn" onClick={() => setShowAddUser(true)}>
                  + Add
                </button>
              </div>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <table className="users-table compact">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredUsers.map(user => (
                    <tr
                      key={user.id}
                      className={selectedUser?.id === user.id ? 'selected' : ''}
                      onClick={() => handleSelectUser(user)}
                    >
                      <td>
                        {editingField?.userId === user.id && editingField?.field === 'email' ? (
                          <input
                            type="email"
                            className="inline-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleEditKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="editable-cell"
                            onDoubleClick={(e) => { e.stopPropagation(); startEditing(user.id, 'email', user.email); }}
                            title="Double-click to edit"
                          >
                            {user.email}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingField?.userId === user.id && editingField?.field === 'name' ? (
                          <input
                            type="text"
                            className="inline-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleEditKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="editable-cell"
                            onDoubleClick={(e) => { e.stopPropagation(); startEditing(user.id, 'name', user.name); }}
                            title="Double-click to edit"
                          >
                            {user.name}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-block', minWidth: '80px', marginRight: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={{ value: user.role, label: user.role.toUpperCase() }}
                            onChange={(option) => handleChangeRole(user.id, option.value)}
                            options={[
                              { value: 'admin', label: 'ADMIN' },
                              { value: 'pm', label: 'PM' }
                            ]}
                            styles={compactSelectStyles}
                            className="role-select"
                            menuPlacement="auto"
                          />
                        </div>
                        {user.id !== currentUser.userId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id, user.email); }}
                            className="delete-user-btn"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedUser && selectedUser.role === 'pm' && (
            <div className="user-permissions">
              <h3>Project Permissions for {selectedUser.name}</h3>

              <div className="permissions-section">
                <h4>Current Permissions</h4>
                {sortedUserPermissions.length === 0 ? (
                  <p className="no-permissions">No project permissions assigned</p>
                ) : (
                  <ul className="permissions-list">
                    {sortedUserPermissions.map(project => (
                      <li key={project.id}>
                        {project.name}
                        <button
                          onClick={() => handleRevokePermission(project.id)}
                          className="revoke-btn"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {availableProjects.length > 0 && (
                <div className="permissions-section">
                  <div className="permissions-section-header">
                    <h4>Grant Access ({filteredAvailableProjects.length}{projectSearchQuery ? ` of ${availableProjects.length}` : ''})</h4>
                    <div className="project-search-box">
                      <MdSearch className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="project-search-input"
                      />
                      {projectSearchQuery && (
                        <button
                          className="search-clear-btn"
                          onClick={() => setProjectSearchQuery('')}
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="permissions-list">
                    {filteredAvailableProjects.map(project => (
                      <li key={project.id}>
                        {project.name}
                        <button
                          onClick={() => handleGrantPermission(project.id)}
                          className="grant-btn"
                        >
                          Grant
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selectedUser && selectedUser.role !== 'pm' && (
            <div className="user-permissions">
              <h3>{selectedUser.name}</h3>
              <p className="role-description">
                {selectedUser.role === 'admin' && 'Admins have full access to all projects and can manage users.'}
              </p>
            </div>
          )}
        </div>


        {showAddUser && (
          <div className="add-user-modal">
            <div className="add-user-content">
              <h3>Add New User</h3>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, name: e.target.value });
                    setNameError(''); // Clear error while typing
                  }}
                  onBlur={(e) => checkNameAvailability(e.target.value)}
                  placeholder="Full Name"
                  className={nameError ? 'input-error' : ''}
                />
                {checkingName && <span className="checking-name">Checking...</span>}
                {nameError && <span className="name-error">{nameError}</span>}
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Password"
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <Select
                  value={{ value: newUser.role, label: newUser.role.toUpperCase() }}
                  onChange={(option) => setNewUser({ ...newUser, role: option.value })}
                  options={[
                    { value: 'pm', label: 'PM' },
                    { value: 'admin', label: 'ADMIN' }
                  ]}
                  styles={selectStyles}
                />
              </div>
              <div className="add-user-actions">
                <button className="save-btn" onClick={handleAddUser}>
                  Create User
                </button>
                <button className="cancel-btn" onClick={() => setShowAddUser(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showEmailsList && (
          <div className="add-user-modal" onClick={() => setShowEmailsList(false)}>
            <div className="emails-list-content" onClick={(e) => e.stopPropagation()}>
              <h3>All User Emails ({users.length})</h3>
              <div className="email-format-selector">
                <label>Format:</label>
                <div className="format-options">
                  <button
                    className={`format-btn ${emailFormat === 'newline' ? 'active' : ''}`}
                    onClick={() => setEmailFormat('newline')}
                    title="Best for Teams group chat"
                  >
                    One per line
                  </button>
                  <button
                    className={`format-btn ${emailFormat === 'comma' ? 'active' : ''}`}
                    onClick={() => setEmailFormat('comma')}
                  >
                    Comma
                  </button>
                  <button
                    className={`format-btn ${emailFormat === 'semicolon' ? 'active' : ''}`}
                    onClick={() => setEmailFormat('semicolon')}
                    title="Best for Outlook"
                  >
                    Semicolon
                  </button>
                </div>
              </div>
              <p className="emails-list-hint">Click to select all, then copy (Ctrl+C / Cmd+C)</p>
              <textarea
                className="emails-textarea"
                value={users.map(u => u.email).join(
                  emailFormat === 'newline' ? '\n' :
                  emailFormat === 'comma' ? ', ' : '; '
                )}
                readOnly
                onClick={(e) => e.target.select()}
                rows={emailFormat === 'newline' ? Math.min(users.length, 10) : 4}
              />
              <div className="emails-list-actions">
                <button className="cancel-btn" onClick={() => setShowEmailsList(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
