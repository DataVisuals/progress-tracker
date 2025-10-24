import React, { useState, useRef, useEffect } from 'react';
import './ProjectSelector.css';

const ProjectSelector = ({ projects, selectedProject, onProjectChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const projectEntries = Object.entries(projects);
  const selectedProjectName = selectedProject ? projects[selectedProject]?.name : '';

  // Filter projects based on search term
  const filteredProjects = projectEntries.filter(([_, project]) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleSelect = (key) => {
    onProjectChange(key);
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
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProjects[highlightedIndex]) {
          handleSelect(filteredProjects[highlightedIndex][0]);
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
    <div className="project-selector" ref={dropdownRef}>
      <label className="selector-label">Select Project:</label>
      <div className="custom-select-container">
        <div
          className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={selectedProject ? 'selected-text' : 'placeholder-text'}>
            {selectedProjectName || '-- Choose a Project --'}
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
              stroke="#003c71"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {isOpen && (
          <div className="custom-select-dropdown" role="listbox">
            <div className="search-container">
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="options-list">
              {filteredProjects.length > 0 ? (
                filteredProjects.map(([key, project], index) => (
                  <div
                    key={key}
                    className={`option-item ${
                      selectedProject === key ? 'selected' : ''
                    } ${highlightedIndex === index ? 'highlighted' : ''}`}
                    onClick={() => handleSelect(key)}
                    role="option"
                    aria-selected={selectedProject === key}
                  >
                    {project.name}
                  </div>
                ))
              ) : (
                <div className="no-results">No projects found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSelector;
