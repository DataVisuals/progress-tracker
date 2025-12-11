import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api/client';
import './JumpToProject.css';

const JumpToProject = ({ isOpen, onClose, portfolios, spaces, onSelectProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Fetch all projects when opening (ignores current filters)
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setLoading(true);

      api.get('/projects')
        .then(response => {
          setAllProjects(response.data || []);
        })
        .catch(err => {
          console.error('Failed to load projects for jump:', err);
          setAllProjects([]);
        })
        .finally(() => {
          setLoading(false);
        });

      // Focus input after a brief delay to ensure overlay is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fuzzy match function - matches if all characters appear in order
  const fuzzyMatch = (text, search) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();

    let searchIdx = 0;
    for (let i = 0; i < textLower.length && searchIdx < searchLower.length; i++) {
      if (textLower[i] === searchLower[searchIdx]) {
        searchIdx++;
      }
    }
    return searchIdx === searchLower.length;
  };

  // Score matches - prefer matches at start of words
  const scoreMatch = (text, search) => {
    if (!search) return 0;
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match at start
    if (textLower.startsWith(searchLower)) return 100;

    // Word boundary match
    const words = textLower.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(searchLower)) return 80;
    }

    // Contains match
    if (textLower.includes(searchLower)) return 60;

    // Fuzzy match
    return 40;
  };

  // Filter and sort projects based on search
  const filteredProjects = useMemo(() => {
    if (!allProjects || allProjects.length === 0) return [];

    const results = allProjects
      .filter(p => fuzzyMatch(p.name, searchTerm))
      .map(p => ({
        ...p,
        score: scoreMatch(p.name, searchTerm),
        portfolioName: portfolios?.find(pf => pf.id === p.portfolio_id)?.name,
        portfolioColor: portfolios?.find(pf => pf.id === p.portfolio_id)?.color,
        spaceName: spaces?.find(s => s.id === p.space_id)?.name
      }))
      .sort((a, b) => {
        // Sort by score descending, then alphabetically
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
      });

    return results.slice(0, 10); // Limit to 10 results
  }, [allProjects, portfolios, spaces, searchTerm]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredProjects.length, searchTerm]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredProjects.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredProjects.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredProjects[selectedIndex]) {
          onSelectProject(filteredProjects[selectedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  // Highlight matching characters in project name
  const highlightMatch = (text, search) => {
    if (!search) return text;

    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();
    const result = [];
    let searchIdx = 0;

    for (let i = 0; i < text.length; i++) {
      if (searchIdx < searchLower.length && textLower[i] === searchLower[searchIdx]) {
        result.push(<mark key={i}>{text[i]}</mark>);
        searchIdx++;
      } else {
        result.push(text[i]);
      }
    }

    return result;
  };

  if (!isOpen) return null;

  return (
    <div className="jump-overlay" onClick={onClose}>
      <div className="jump-modal" onClick={e => e.stopPropagation()}>
        <div className="jump-search-container">
          <svg className="jump-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="jump-search-input"
            placeholder="Jump to project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="jump-shortcut-hint">
            <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd> close
          </div>
        </div>

        <div className="jump-results" ref={listRef}>
          {loading ? (
            <div className="jump-no-results">Loading projects...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="jump-no-results">
              {searchTerm ? 'No projects found' : 'Type to search projects'}
            </div>
          ) : (
            filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className={`jump-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectProject(project);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="jump-result-main">
                  <span className="jump-result-name">
                    {highlightMatch(project.name, searchTerm)}
                  </span>
                </div>
                <div className="jump-result-meta">
                  {project.portfolioName && (
                    <span
                      className="jump-result-portfolio"
                      style={{ backgroundColor: project.portfolioColor || '#888' }}
                    >
                      {project.portfolioName}
                    </span>
                  )}
                  {project.spaceName && (
                    <span className="jump-result-space">
                      {project.spaceName}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default JumpToProject;
