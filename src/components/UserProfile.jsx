import React, { useState } from 'react';
import { api } from '../api/client';
import './FormInputs.css';
import './PasswordChange.css';

const UserProfile = ({ currentUser, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProfileSubmit = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (!name || !email) {
      setError('Name and email are required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await api.updateProfile(name, email);

      // Update local storage
      localStorage.setItem('user', JSON.stringify(response.data));

      setSuccess('Profile updated successfully!');

      // Notify parent component
      if (onUpdate) {
        onUpdate(response.data);
      }

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Password change error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content password-change-modal" onClick={(e) => e.stopPropagation()}>
        <h2>User Settings</h2>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'profile' ? '600' : '400',
              color: activeTab === 'profile' ? '#003c71' : '#6b7280',
              borderBottom: activeTab === 'profile' ? '2px solid #003c71' : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => {
              setActiveTab('profile');
              setError('');
              setSuccess('');
            }}
          >
            Profile
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'password' ? '600' : '400',
              color: activeTab === 'password' ? '#003c71' : '#6b7280',
              borderBottom: activeTab === 'password' ? '2px solid #003c71' : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => {
              setActiveTab('password');
              setError('');
              setSuccess('');
            }}
          >
            Change Password
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {activeTab === 'profile' ? (
          <>
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                disabled={loading}
              />
            </div>

            <div className="modal-actions">
              <button
                className="save-btn"
                onClick={handleProfileSubmit}
                disabled={loading || (name === currentUser.name && email === currentUser.email)}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="cancel-btn"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="current-password">Current Password *</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password..."
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Password *</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)..."
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password *</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
                disabled={loading}
              />
            </div>

            <div className="modal-actions">
              <button
                className="save-btn"
                onClick={handlePasswordSubmit}
                disabled={loading}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
              <button
                className="cancel-btn"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
