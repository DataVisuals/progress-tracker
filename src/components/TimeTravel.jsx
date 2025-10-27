import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './TimeTravel.css';

const TimeTravel = ({ projectId, onTimeTravelChange }) => {
  const [auditTimestamps, setAuditTimestamps] = useState([]);
  const [sliderIndex, setSliderIndex] = useState(-1); // -1 means "present"
  const [loading, setLoading] = useState(false);

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
          {auditTimestamps.length} historical snapshots available
        </div>
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
