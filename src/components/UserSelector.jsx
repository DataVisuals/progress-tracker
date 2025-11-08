import React, { useState, useRef, useEffect } from 'react';
import './UserSelector.css';

const UserSelector = ({ users, selectedUser, onUserChange, placeholder = 'Select user...', label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedUserData = users.find(u => u.id === selectedUser?.value || u.id === selectedUser);

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (user) => {
    onUserChange(user ? { value: user.id, label: user.name } : null);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredUsers[highlightedIndex]) {
          handleSelect(filteredUsers[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="user-selector" ref={dropdownRef}>
      <div className="user-select-container">
        <div
          className={`user-select-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={selectedUserData ? 'selected-text' : 'placeholder-text'}>
            {selectedUserData?.name || placeholder}
          </span>
          <svg
            className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {isOpen && (
          <div className="user-select-dropdown" role="listbox">
            <div className="search-container">
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="options-list">
              {/* Clear option */}
              <div
                className={`option-item ${!selectedUserData ? 'selected' : ''} ${highlightedIndex === -1 ? 'highlighted' : ''}`}
                onClick={() => handleSelect(null)}
                role="option"
                aria-selected={!selectedUserData}
              >
                <span className="option-name clear-option">Clear selection</span>
              </div>

              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className={`option-item ${
                      selectedUserData?.id === user.id ? 'selected' : ''
                    } ${highlightedIndex === index ? 'highlighted' : ''}`}
                    onClick={() => handleSelect(user)}
                    role="option"
                    aria-selected={selectedUserData?.id === user.id}
                  >
                    <span className="option-name">{user.name}</span>
                  </div>
                ))
              ) : (
                <div className="no-results">No users found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSelector;
