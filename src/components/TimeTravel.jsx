import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './TimeTravel.css';

const TimeTravel = ({ projectId, onTimeTravelChange, onRevert, isAdmin = false }) => {
  const [auditTimestamps, setAuditTimestamps] = useState([]);
  const [sliderIndex, setSliderIndex] = useState(-1); // -1 means "present"
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadAuditTimestamps();
    }
  }, [projectId]);

  const loadAuditTimestamps = async () => {
    try {
      // Get audit log entries for this project's metric_periods
      const response = await api.getAuditLog({
        table_name: 'metric_periods',
        limit: 500
      });

      // Extract and sort timestamps (oldest to newest for slider)
      const timestamps = response.data
        .map(log => log.created_at)
        .sort((a, b) => new Date(a) - new Date(b));

      setAuditTimestamps(timestamps);
      setSliderIndex(timestamps.length); // Start at "present" (max position)
    } catch (err) {
      console.error('Failed to load audit timestamps:', err);
    }
  };

  const handleSliderChange = async (e) => {
    const index = parseInt(e.target.value);
    setSliderIndex(index);
    setLoading(true);

    try {
      if (index >= auditTimestamps.length) {
        // At the end - return to present
        await onTimeTravelChange(null);
      } else {
        // Load historical state at this timestamp
        await onTimeTravelChange(auditTimestamps[index]);
      }
    } catch (err) {
      console.error('Failed to time travel:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Present';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentTimestamp = () => {
    if (sliderIndex < 0 || sliderIndex >= auditTimestamps.length) {
      return null;
    }
    return auditTimestamps[sliderIndex];
  };

  const isAtPresent = sliderIndex >= auditTimestamps.length;

  const handleRevert = async () => {
    const currentTimestamp = getCurrentTimestamp();
    if (!currentTimestamp) {
      alert('Cannot revert to present state');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to revert ALL project data to the state at ${formatTimestamp(currentTimestamp)}?\n\n` +
      'This will:\n' +
      '• Update all metric periods to their historical values\n' +
      '• Restore deleted periods\n' +
      '• Delete periods that were added after this time\n' +
      '• Create audit log entries for all changes\n\n' +
      'This action can be undone using Time Travel.'
    );

    if (!confirmed) return;

    setReverting(true);
    try {
      const response = await api.revertProjectData(projectId, currentTimestamp);
      alert(
        `Successfully reverted to ${formatTimestamp(currentTimestamp)}\n\n` +
        `Updated: ${response.data.changes.updated}\n` +
        `Deleted: ${response.data.changes.deleted}\n` +
        `Restored: ${response.data.changes.restored}\n` +
        `Unchanged: ${response.data.changes.unchanged}`
      );

      // Call the onRevert callback to refresh the data
      if (onRevert) {
        await onRevert();
      }

      // Reset to present view
      setSliderIndex(auditTimestamps.length);
      await onTimeTravelChange(null);
    } catch (err) {
      console.error('Failed to revert:', err);
      alert(`Failed to revert: ${err.response?.data?.error || err.message}`);
    } finally {
      setReverting(false);
    }
  };

  if (auditTimestamps.length === 0) {
    return null; // No historical data available
  }

  return (
    <div className={`time-travel-slider-container ${!isAtPresent ? 'active' : ''}`}>
      <div className="time-travel-header">
        <span className="time-travel-icon">⏱️</span>
        <span className="time-travel-title">Time Travel</span>
      </div>

      <div className="time-travel-slider-section">
        <div className="time-travel-timestamp">
          {formatTimestamp(getCurrentTimestamp())}
          {!isAtPresent && (
            <span className="time-travel-viewing-badge">Viewing History</span>
          )}
        </div>

        <div className="slider-container">
          <span className="slider-label">Past</span>
          <input
            type="range"
            min="0"
            max={auditTimestamps.length}
            value={sliderIndex}
            onChange={handleSliderChange}
            className="time-travel-slider"
            disabled={loading}
          />
          <span className="slider-label">Present</span>
        </div>

        <div className="slider-info">
          {isAtPresent ? (
            <span>
              <strong>Current view</strong> • {auditTimestamps.length} historical snapshots available
            </span>
          ) : (
            <span>
              <strong>Snapshot {sliderIndex + 1} of {auditTimestamps.length}</strong> • {auditTimestamps.length} snapshots available
            </span>
          )}
        </div>

        {!isAtPresent && isAdmin && (
          <div className="revert-action">
            <button
              onClick={handleRevert}
              disabled={reverting || loading}
              className="revert-btn"
              title="Revert all project data to this historical state (Admin only)"
            >
              {reverting ? 'Reverting...' : '⟲ Revert to This State'}
            </button>
            <p className="revert-warning">
              This will restore all metrics to their state at this point in time
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="time-travel-loading">
          Loading historical data...
        </div>
      )}
    </div>
  );
};

export default TimeTravel;
