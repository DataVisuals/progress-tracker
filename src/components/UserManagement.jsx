import React, { useState, useEffect } from 'react';
import Select from 'react-select';
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

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await api.register(newUser.email, newUser.name, newUser.password);

      // Now update the role if it's not viewer (default)
      const usersResponse = await api.getUsers();
      const createdUser = usersResponse.data.find(u => u.email === newUser.email);

      if (createdUser && newUser.role !== 'viewer') {
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
      case 'viewer': return 'role-badge-viewer';
      default: return '';
    }
  };

  const availableProjects = projects.filter(
    p => !userPermissions.some(up => up.id === p.id)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-management-modal" onClick={(e) => e.stopPropagation()}>
        <h2>User Management</h2>

        <div className="user-management-container">
          <div className="users-list">
            <div className="users-list-header">
              <h3>Users</h3>
              <button className="add-user-btn" onClick={() => setShowAddUser(true)}>
                + Add User
              </button>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user.id}
                      className={selectedUser?.id === user.id ? 'selected' : ''}
                      onClick={() => handleSelectUser(user)}
                    >
                      <td>{user.email}</td>
                      <td>{user.name}</td>
                      <td>
                        <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-block', minWidth: '120px', marginRight: '8px' }}>
                          <Select
                            value={{ value: user.role, label: user.role.toUpperCase() }}
                            onChange={(option) => handleChangeRole(user.id, option.value)}
                            options={[
                              { value: 'admin', label: 'ADMIN' },
                              { value: 'pm', label: 'PM' },
                              { value: 'viewer', label: 'VIEWER' }
                            ]}
                            styles={compactSelectStyles}
                            className="role-select"
                          />
                        </div>
                        {user.id !== currentUser.userId && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
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
                {userPermissions.length === 0 ? (
                  <p className="no-permissions">No project permissions assigned</p>
                ) : (
                  <ul className="permissions-list">
                    {userPermissions.map(project => (
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
                  <h4>Grant Access to Projects</h4>
                  <ul className="permissions-list">
                    {availableProjects.map(project => (
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
                {selectedUser.role === 'viewer' && 'Viewers have read-only access to all projects.'}
              </p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Close
          </button>
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
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Full Name"
                />
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
      </div>
    </div>
  );
};

export default UserManagement;
