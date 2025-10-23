import React from 'react';
import './AxisToggle.css';

const AxisToggle = ({ axisType, onAxisTypeChange }) => {
  return (
    <div className="axis-toggle">
      <span className="toggle-label">X-Axis:</span>
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${axisType === 'period' ? 'active' : ''}`}
          onClick={() => onAxisTypeChange('period')}
        >
          Reporting Period
        </button>
        <button
          className={`toggle-btn ${axisType === 'date' ? 'active' : ''}`}
          onClick={() => onAxisTypeChange('date')}
        >
          Reporting Date
        </button>
      </div>
    </div>
  );
};

export default AxisToggle;
