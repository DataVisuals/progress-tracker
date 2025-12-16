import React, { useState, useEffect, useCallback } from 'react';
import {
  MdClose,
  MdArrowBack,
  MdArrowForward,
  MdPlayArrow,
  MdAccountTree,
  MdFolderSpecial,
  MdShowChart,
  MdTrendingUp,
  MdEdit,
  MdTimeline,
  MdDashboard,
  MdTune,
  MdBuild,
  MdLayers,
  MdCheckCircle,
  MdWarning,
  MdComment,
  MdPeople,
  MdAssignment,
  MdFilterList,
  MdHistory,
  MdDock,
  MdOpenInNew,
  MdSearch,
  MdKeyboardArrowUp,
  MdKeyboardArrowDown
} from 'react-icons/md';
import './Tutorial.css';

const Tutorial = ({ onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState('next');

  const pages = [
    // Page 0: Welcome
    {
      type: 'welcome',
      title: 'Welcome to Progress Tracker',
      subtitle: 'Your guide to tracking projects with objective metrics',
      icon: <MdPlayArrow />,
      content: (
        <div className="tutorial-welcome">
          <div className="welcome-hero">
            <div className="hero-icon-container">
              <MdDashboard className="hero-icon" />
            </div>
            <p className="welcome-tagline">Track progress, not promises</p>
          </div>
          <div className="welcome-features">
            <div className="welcome-feature">
              <MdShowChart />
              <span>Data-driven status</span>
            </div>
            <div className="welcome-feature">
              <MdTrendingUp />
              <span>Predict outcomes</span>
            </div>
            <div className="welcome-feature">
              <MdPeople />
              <span>Team transparency</span>
            </div>
          </div>
          <p className="welcome-instruction">Use the arrows below to navigate through this tutorial</p>
        </div>
      )
    },
    // Page 1: Hierarchy Overview
    {
      type: 'concept',
      title: 'Understanding the Hierarchy',
      subtitle: 'How information is organized',
      icon: <MdAccountTree />,
      content: (
        <div className="tutorial-hierarchy">
          <div className="hierarchy-diagram">
            <div className="hierarchy-level level-1">
              <div className="hierarchy-box space-box">
                <MdLayers className="hierarchy-icon" />
                <span>Spaces</span>
              </div>
              <div className="hierarchy-description">Top-level divisions (e.g., departments, business units)</div>
            </div>
            <div className="hierarchy-connector"></div>
            <div className="hierarchy-level level-2">
              <div className="hierarchy-box portfolio-box">
                <MdFolderSpecial className="hierarchy-icon" />
                <span>Portfolios</span>
              </div>
              <div className="hierarchy-description">Groups of related projects</div>
            </div>
            <div className="hierarchy-connector"></div>
            <div className="hierarchy-level level-3">
              <div className="hierarchy-box project-box">
                <MdAssignment className="hierarchy-icon" />
                <span>Projects</span>
              </div>
              <div className="hierarchy-description">Individual initiatives with goals</div>
            </div>
            <div className="hierarchy-connector"></div>
            <div className="hierarchy-level level-4">
              <div className="hierarchy-box metric-box">
                <MdShowChart className="hierarchy-icon" />
                <span>Metrics</span>
              </div>
              <div className="hierarchy-description">Quantifiable measures of progress</div>
            </div>
          </div>
        </div>
      )
    },
    // Page 2: Creating Spaces
    {
      type: 'guide',
      title: 'Step 1: Create a Space',
      subtitle: 'Organize work by department or team',
      icon: <MdLayers />,
      steps: [
        'Click the Space dropdown in the sidebar',
        'Select "Manage Spaces" (admin only)',
        'Click "Add Space" and enter a name',
        'Spaces help separate different business areas'
      ],
      tip: 'Most users will work within existing spaces. Ask your admin if you need a new one.',
      visual: (
        <div className="tutorial-visual space-visual">
          <div className="mock-dropdown">
            <div className="mock-dropdown-header">
              <MdLayers /> All Spaces
            </div>
            <div className="mock-dropdown-items">
              <div className="mock-item">Engineering</div>
              <div className="mock-item">Marketing</div>
              <div className="mock-item highlighted">+ Manage Spaces</div>
            </div>
          </div>
        </div>
      )
    },
    // Page 3: Creating Portfolios
    {
      type: 'guide',
      title: 'Step 2: Create a Portfolio',
      subtitle: 'Group related projects together',
      icon: <MdFolderSpecial />,
      steps: [
        'Select a Space from the dropdown',
        'Click the Portfolio dropdown',
        'Select "Manage Portfolios"',
        'Click "Add Portfolio", name it, and choose a color'
      ],
      tip: 'Use colors to quickly identify portfolios. Choose colors that align with your team\'s conventions.',
      visual: (
        <div className="tutorial-visual portfolio-visual">
          <div className="mock-portfolios">
            <div className="mock-portfolio" style={{ borderLeftColor: '#3b82f6' }}>
              <span className="portfolio-dot" style={{ background: '#3b82f6' }}></span>
              Digital Transformation
            </div>
            <div className="mock-portfolio" style={{ borderLeftColor: '#10b981' }}>
              <span className="portfolio-dot" style={{ background: '#10b981' }}></span>
              Infrastructure
            </div>
            <div className="mock-portfolio" style={{ borderLeftColor: '#f59e0b' }}>
              <span className="portfolio-dot" style={{ background: '#f59e0b' }}></span>
              Customer Experience
            </div>
          </div>
        </div>
      )
    },
    // Page 4: Creating Projects
    {
      type: 'guide',
      title: 'Step 3: Create a Project',
      subtitle: 'Define what you\'re tracking',
      icon: <MdAssignment />,
      steps: [
        'Select a Portfolio to contain your project',
        'Click the Project dropdown and select "New Project"',
        'Enter a descriptive name and project manager',
        'Add a description that explains the business outcome'
      ],
      tip: 'Good project descriptions help stakeholders understand the "why" behind your metrics.',
      visual: (
        <div className="tutorial-visual project-visual">
          <div className="mock-project-card">
            <div className="mock-project-header">
              <span className="portfolio-indicator" style={{ background: '#3b82f6' }}></span>
              <h4>Mobile App Relaunch</h4>
            </div>
            <div className="mock-project-meta">
              <span><MdPeople /> Sarah Chen</span>
              <span>Jan 2025 - Dec 2025</span>
            </div>
            <p className="mock-project-desc">
              Modernize our mobile platform to improve customer engagement and reduce churn by 20%.
            </p>
          </div>
        </div>
      )
    },
    // Page 5: Creating Metrics
    {
      type: 'guide',
      title: 'Step 4: Add Metrics',
      subtitle: 'Define what success looks like',
      icon: <MdShowChart />,
      steps: [
        'Open a project and go to the Metrics tab',
        'Click "+ Add Metric"',
        'Name it, set dates, frequency, and target',
        'Choose a progression type (linear, S-curve, etc.)'
      ],
      tip: 'Use lead metrics (predictive) and lag metrics (outcome-based) for a complete picture.',
      visual: (
        <div className="tutorial-visual metric-visual">
          <div className="mock-metric-form">
            <div className="form-field">
              <label>Metric Name</label>
              <div className="form-input">Features Delivered</div>
            </div>
            <div className="form-row">
              <div className="form-field half">
                <label>Frequency</label>
                <div className="form-input">Weekly</div>
              </div>
              <div className="form-field half">
                <label>Final Target</label>
                <div className="form-input">48</div>
              </div>
            </div>
            <div className="form-field">
              <label>Progression</label>
              <div className="progression-options">
                <span className="prog-option active">Linear</span>
                <span className="prog-option">S-Curve</span>
                <span className="prog-option">Exponential</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Page 6: Understanding RAG Status
    {
      type: 'concept',
      title: 'RAG Status Explained',
      subtitle: 'How progress is measured',
      icon: <MdTune />,
      content: (
        <div className="tutorial-rag">
          <p className="rag-intro">Metrics are automatically colored based on variance from expected progress:</p>
          <div className="rag-statuses">
            <div className="rag-status green">
              <div className="rag-indicator"></div>
              <div className="rag-details">
                <h4>Green</h4>
                <p>On track - within tolerance of expected progress</p>
              </div>
            </div>
            <div className="rag-status amber">
              <div className="rag-indicator"></div>
              <div className="rag-details">
                <h4>Amber</h4>
                <p>At risk - behind by more than amber tolerance (default 5%)</p>
              </div>
            </div>
            <div className="rag-status red">
              <div className="rag-indicator"></div>
              <div className="rag-details">
                <h4>Red</h4>
                <p>Off track - behind by more than red tolerance (default 10%)</p>
              </div>
            </div>
          </div>
          <div className="rag-formula">
            <MdTune className="formula-icon" />
            <span>Tolerances can be adjusted per metric to suit different risk appetites</span>
          </div>
        </div>
      )
    },
    // Page 7: Updating Metrics
    {
      type: 'guide',
      title: 'Updating Your Metrics',
      subtitle: 'Keep data current for accurate status',
      icon: <MdEdit />,
      steps: [
        'Open a metric chart by clicking the metric name',
        'Click on any cell in the data grid to edit',
        'Enter the actual "Complete" value for each period',
        'Add commentary to explain any variance'
      ],
      tip: 'Update metrics regularly - stale data is worse than no data!',
      visual: (
        <div className="tutorial-visual edit-visual">
          <div className="mock-chart">
            <div className="chart-bars">
              <div className="chart-bar" style={{ height: '30%' }}></div>
              <div className="chart-bar" style={{ height: '45%' }}></div>
              <div className="chart-bar" style={{ height: '60%' }}></div>
              <div className="chart-bar editing" style={{ height: '70%' }}>
                <div className="edit-indicator">
                  <MdEdit />
                </div>
              </div>
              <div className="chart-bar expected" style={{ height: '85%' }}></div>
              <div className="chart-bar expected" style={{ height: '100%' }}></div>
            </div>
            <div className="chart-line"></div>
          </div>
        </div>
      )
    },
    // Page 8: Recovery Plans
    {
      type: 'guide',
      title: 'When Things Go Red',
      subtitle: 'Create recovery plans to get back on track',
      icon: <MdBuild />,
      steps: [
        'When a metric turns red, you\'ll see a recovery plan prompt',
        'Click "Add Recovery Plan" on the metric',
        'Describe what actions you\'ll take to recover',
        'Set target dates and track progress'
      ],
      tip: 'Recovery plans show stakeholders you have a path forward, not just problems.',
      visual: (
        <div className="tutorial-visual recovery-visual">
          <div className="mock-recovery">
            <div className="recovery-header">
              <MdWarning className="warning-icon" />
              <span>Recovery Plan Required</span>
            </div>
            <div className="recovery-item">
              <MdCheckCircle className="check-icon" />
              <div className="recovery-content">
                <strong>Add 2 contractors to dev team</strong>
                <span>Due: Feb 15</span>
              </div>
            </div>
            <div className="recovery-item">
              <div className="pending-icon"></div>
              <div className="recovery-content">
                <strong>Descope Phase 2 features</strong>
                <span>Due: Feb 20</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Page 9: Key Features
    {
      type: 'features',
      title: 'Key Features to Explore',
      subtitle: 'Get the most out of Progress Tracker',
      icon: <MdDashboard />,
      features: [
        {
          icon: <MdHistory />,
          name: 'Time Travel',
          desc: 'View your metrics as they appeared at any past date'
        },
        {
          icon: <MdFilterList />,
          name: 'Filters',
          desc: 'Focus on red/amber metrics or specific portfolios'
        },
        {
          icon: <MdComment />,
          name: 'Commentary',
          desc: 'Add context and explanations to your metrics'
        },
        {
          icon: <MdTimeline />,
          name: 'Progression Curves',
          desc: 'Set expected trajectories: linear, S-curve, exponential'
        },
        {
          icon: <MdCheckCircle />,
          name: 'Consistency Checks',
          desc: 'Automated reports flag data quality issues'
        },
        {
          icon: <MdPeople />,
          name: 'Collaboration',
          desc: 'Share projects, leave feedback, track discussions'
        }
      ]
    },
    // Page 10: The Dock
    {
      type: 'guide',
      title: 'The Dock',
      subtitle: 'Quick full-screen views of your data',
      icon: <MdDock />,
      steps: [
        'The dock appears at the bottom of your screen',
        'Click any icon to open a full-screen view',
        'Options include: All Projects, Red Metrics, Milestones, and more',
        'Use the zoom slider to expand the dock for easier selection'
      ],
      tip: 'Full-screen views are great for presentations and executive reviews!',
      visual: (
        <div className="tutorial-visual dock-visual">
          <div className="mock-dock">
            <div className="mock-dock-item" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <MdDashboard />
              <span className="dock-label">All Projects</span>
            </div>
            <div className="mock-dock-item" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <MdWarning />
              <span className="dock-label">Red Metrics</span>
            </div>
            <div className="mock-dock-item" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <MdTimeline />
              <span className="dock-label">Milestones</span>
            </div>
            <div className="mock-dock-item" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <MdTrendingUp />
              <span className="dock-label">Trends</span>
            </div>
          </div>
        </div>
      )
    },
    // Page 11: Project Jump
    {
      type: 'guide',
      title: 'Project Jump',
      subtitle: 'Navigate anywhere instantly with keyboard shortcuts',
      icon: <MdSearch />,
      steps: [
        'Press "/" (forward slash) to open Project Jump',
        'Start typing to search projects, metrics, or portfolios',
        'Use arrow keys to navigate, Enter to select',
        'Press Escape to close without selecting'
      ],
      tip: 'Project Jump searches across all spaces and portfolios - perfect for large organizations!',
      visual: (
        <div className="tutorial-visual jump-visual">
          <div className="mock-jump-dialog">
            <div className="mock-jump-header">
              <MdSearch className="jump-search-icon" />
              <span className="jump-input">mobile app...</span>
            </div>
            <div className="mock-jump-results">
              <div className="jump-result highlighted">
                <MdAssignment className="jump-result-icon" />
                <div className="jump-result-text">
                  <span className="jump-result-name">Mobile App Relaunch</span>
                  <span className="jump-result-path">Engineering → Digital</span>
                </div>
              </div>
              <div className="jump-result">
                <MdShowChart className="jump-result-icon" />
                <div className="jump-result-text">
                  <span className="jump-result-name">Mobile Downloads</span>
                  <span className="jump-result-path">Marketing → Growth</span>
                </div>
              </div>
            </div>
            <div className="mock-jump-footer">
              <span><MdKeyboardArrowUp /><MdKeyboardArrowDown /> navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )
    },
    // Page 12: Get Started
    {
      type: 'finish',
      title: 'You\'re Ready!',
      subtitle: 'Start tracking with confidence',
      icon: <MdCheckCircle />,
      content: (
        <div className="tutorial-finish">
          <div className="finish-checkmark">
            <MdCheckCircle />
          </div>
          <div className="finish-summary">
            <h4>Quick Recap:</h4>
            <ol>
              <li>Organize into <strong>Spaces</strong> and <strong>Portfolios</strong></li>
              <li>Create <strong>Projects</strong> with clear outcomes</li>
              <li>Add <strong>Metrics</strong> that measure real progress</li>
              <li>Update regularly and add <strong>Commentary</strong></li>
              <li>Use <strong>Recovery Plans</strong> when off track</li>
            </ol>
          </div>
          <div className="finish-actions">
            <p>Need more help? Click the <MdBuild /> icon in the sidebar for tips and best practices.</p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1 && !isFlipping) {
      setFlipDirection('next');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsFlipping(false);
      }, 300);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0 && !isFlipping) {
      setFlipDirection('prev');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => prev - 1);
        setIsFlipping(false);
      }, 300);
    }
  };

  const handleDotClick = (index) => {
    if (index !== currentPage && !isFlipping) {
      setFlipDirection(index > currentPage ? 'next' : 'prev');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(index);
        setIsFlipping(false);
      }, 300);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentPage < pages.length - 1 && !isFlipping) {
        setFlipDirection('next');
        setIsFlipping(true);
        setTimeout(() => {
          setCurrentPage(prev => prev + 1);
          setIsFlipping(false);
        }, 300);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentPage > 0 && !isFlipping) {
        setFlipDirection('prev');
        setIsFlipping(true);
        setTimeout(() => {
          setCurrentPage(prev => prev - 1);
          setIsFlipping(false);
        }, 300);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [currentPage, isFlipping, pages.length, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const page = pages[currentPage];

  const renderPageContent = () => {
    switch (page.type) {
      case 'welcome':
      case 'concept':
      case 'finish':
        return page.content;

      case 'guide':
        return (
          <div className="tutorial-guide">
            {page.visual && (
              <div className="guide-visual-section">
                {page.visual}
              </div>
            )}
            <div className="guide-steps">
              {page.steps.map((step, idx) => (
                <div key={idx} className="guide-step">
                  <span className="step-number">{idx + 1}</span>
                  <span className="step-text">{step}</span>
                </div>
              ))}
            </div>
            {page.tip && (
              <div className="guide-tip">
                <MdBuild className="tip-icon" />
                <span>{page.tip}</span>
              </div>
            )}
          </div>
        );

      case 'features':
        return (
          <div className="tutorial-features-grid">
            {page.features.map((feature, idx) => (
              <div key={idx} className="tutorial-feature-item">
                <div className="feature-icon">{feature.icon}</div>
                <div className="feature-info">
                  <h4>{feature.name}</h4>
                  <p>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="tutorial-overlay" onClick={onClose}>
      {/* Left arrow navigation */}
      <button
        className="tutorial-side-nav prev"
        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        disabled={currentPage === 0}
        aria-label="Previous page"
      >
        <MdArrowBack />
      </button>

      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tutorial-close" onClick={onClose}>
          <MdClose />
        </button>

        <div className={`tutorial-page ${isFlipping ? `flipping-${flipDirection}` : ''}`}>
          <div className="tutorial-header">
            <div className="tutorial-icon">
              {page.icon}
            </div>
            <h2 className="tutorial-title">{page.title}</h2>
            <p className="tutorial-subtitle">{page.subtitle}</p>
          </div>

          <div className="tutorial-body">
            {renderPageContent()}
          </div>
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
              />
            </div>
            <span className="progress-text">{currentPage + 1} of {pages.length}</span>
          </div>

          <div className="tutorial-dots">
            {pages.map((_, index) => (
              <button
                key={index}
                className={`tutorial-dot ${index === currentPage ? 'active' : ''} ${index < currentPage ? 'completed' : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          {currentPage === pages.length - 1 && (
            <button
              className="tutorial-finish-btn"
              onClick={onClose}
            >
              <span>Get Started</span>
              <MdCheckCircle />
            </button>
          )}
        </div>
      </div>

      {/* Right arrow navigation */}
      <button
        className="tutorial-side-nav next"
        onClick={(e) => { e.stopPropagation(); handleNext(); }}
        disabled={currentPage === pages.length - 1}
        aria-label="Next page"
      >
        <MdArrowForward />
      </button>
    </div>
  );
};

export default Tutorial;
