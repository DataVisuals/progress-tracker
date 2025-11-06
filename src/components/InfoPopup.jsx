import React, { useState } from 'react';
import './InfoPopup.css';

const InfoPopup = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="info-popup-container">
      <button
        className="info-popup-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="More information"
        type="button"
      >
        ℹ️
      </button>
      {isOpen && (
        <>
          <div className="info-popup-overlay" onClick={() => setIsOpen(false)} />
          <div className="info-popup-content">
            <button
              className="info-popup-close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            {children}
          </div>
        </>
      )}
    </div>
  );
};

export default InfoPopup;
