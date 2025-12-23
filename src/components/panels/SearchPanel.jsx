import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MdSearch, MdFilterAlt } from 'react-icons/md';

// Fuzzy match function
const fuzzyMatch = (str, pattern) => {
  if (!pattern) return true;
  const lowerStr = str.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  let patternIdx = 0;
  for (let i = 0; i < lowerStr.length && patternIdx < lowerPattern.length; i++) {
    if (lowerStr[i] === lowerPattern[patternIdx]) {
      patternIdx++;
    }
  }
  return patternIdx === lowerPattern.length;
};

// Score match function
const scoreMatch = (str, pattern) => {
  if (!pattern) return 0;
  const lowerStr = str.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  // Exact match gets highest score
  if (lowerStr === lowerPattern) return 100;

  // Starts with pattern gets high score
  if (lowerStr.startsWith(lowerPattern)) return 90;

  // Contains pattern as substring
  if (lowerStr.includes(lowerPattern)) return 80;

  // Fuzzy match score based on how close the characters are
  let score = 0;
  let lastMatchIdx = -1;
  let patternIdx = 0;
  for (let i = 0; i < lowerStr.length && patternIdx < lowerPattern.length; i++) {
    if (lowerStr[i] === lowerPattern[patternIdx]) {
      score += 10;
      if (lastMatchIdx !== -1 && i === lastMatchIdx + 1) {
        score += 5; // Consecutive bonus
      }
      lastMatchIdx = i;
      patternIdx++;
    }
  }
  return score;
};

// Highlight match function
const highlightMatch = (str, pattern) => {
  if (!pattern) return str;
  const lowerStr = str.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  const result = [];
  let lastIdx = 0;
  let patternIdx = 0;

  for (let i = 0; i < str.length && patternIdx < lowerPattern.length; i++) {
    if (lowerStr[i] === lowerPattern[patternIdx]) {
      if (i > lastIdx) {
        result.push(str.slice(lastIdx, i));
      }
      result.push(<mark key={i}>{str[i]}</mark>);
      lastIdx = i + 1;
      patternIdx++;
    }
  }
  if (lastIdx < str.length) {
    result.push(str.slice(lastIdx));
  }
  return result;
};

const SearchPanel = ({
  panelId,
  index,
  forDock,
  projects,
  portfolios,
  spaces,
  selectedSpace,
  onNavigateToProject
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);

  const searchFilteredProjects = useMemo(() => {
    const projectList = Object.entries(projects).map(([id, project]) => ({ ...project, id }));
    if (!projectList.length) return [];

    // Filter by space if a space is selected
    const spaceFiltered = selectedSpace === 'all'
      ? projectList
      : projectList.filter(p => {
          const portfolio = portfolios?.find(pf => pf.id === p.portfolio_id);
          return portfolio?.space_id === Number(selectedSpace);
        });

    return spaceFiltered
      .filter(p => fuzzyMatch(p.name, searchTerm))
      .map(p => ({
        ...p,
        score: scoreMatch(p.name, searchTerm),
        portfolioName: portfolios?.find(pf => pf.id === p.portfolio_id)?.name,
        portfolioColor: portfolios?.find(pf => pf.id === p.portfolio_id)?.color,
        spaceName: spaces?.find(s => s.id === p.space_id)?.name
      }))
      .sort((a, b) => b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [projects, portfolios, spaces, searchTerm, selectedSpace]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex(prev => Math.min(prev + 1, searchFilteredProjects.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && searchFilteredProjects.length > 0) {
      e.preventDefault();
      const selectedProject = searchFilteredProjects[searchSelectedIndex];
      if (selectedProject) {
        onNavigateToProject(selectedProject.id);
      }
    }
  }, [searchFilteredProjects, searchSelectedIndex, onNavigateToProject]);

  return (
    <div key={panelId} className={`home-quadrant search-quadrant panel-${index + 1}`}>
      <div className="home-search-view">
        <div className="search-container">
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>
          {selectedSpace !== 'all' && (
            <div className="search-space-warning">
              <MdFilterAlt className="warning-icon" />
              Searching within {spaces.find(s => s.id === Number(selectedSpace))?.name || 'selected space'}
            </div>
          )}
          {searchTerm && (
            <div className="search-results">
              {searchFilteredProjects.length === 0 ? (
                <div className="search-no-results">No projects found</div>
              ) : (
                searchFilteredProjects.map((project, idx) => (
                  <div
                    key={project.id}
                    className={`search-result-item ${idx === searchSelectedIndex ? 'selected' : ''}`}
                    onClick={() => onNavigateToProject(project.id)}
                    onMouseEnter={() => setSearchSelectedIndex(idx)}
                  >
                    <div className="search-result-main">
                      <span className="search-result-name">
                        {highlightMatch(project.name, searchTerm)}
                      </span>
                    </div>
                    <div className="search-result-meta">
                      {project.portfolioName && (
                        <span
                          className="search-result-portfolio"
                          style={{ backgroundColor: project.portfolioColor || '#888' }}
                        >
                          {project.portfolioName}
                        </span>
                      )}
                      {project.spaceName && (
                        <span className="search-result-space">{project.spaceName}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="search-hint">
            <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
