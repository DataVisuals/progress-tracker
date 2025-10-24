import React, { useState } from 'react';
import { api } from '../api/client';
import './FormInputs.css';
import './PasswordChange.css';

const PasswordChange = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
      console.error('Error response:', err.response);
      setError(err.response?.data?.error || err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content password-change-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Change Password</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

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
            onClick={handleSubmit}
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
      </div>
    </div>
  );
};

export default PasswordChange;
