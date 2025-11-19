import React, { useState, useEffect } from 'react';
import {
  MdClose,
  MdArrowBack,
  MdArrowForward,
  MdSpeed,
  MdTimeline,
  MdTrendingUp,
  MdFilterList,
  MdFolderSpecial,
  MdCheckCircle,
  MdList,
  MdEdit,
  MdShare,
  MdHistory,
  MdSecurity,
  MdAssessment,
  MdFeedback,
  MdComment,
  MdPictureAsPdf,
  MdTune,
  MdLink,
  MdLightbulb,
  MdWarning,
  MdTrackChanges,
  MdShowChart
} from 'react-icons/md';
import './FeatureShowreel.css';

const TipsSplash = ({ onClose, onDismissPermanently }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const tips = [
    // Best practice tips
    {
      icon: <MdTrackChanges />,
      title: "Use Cumulative Metrics",
      description: "Metrics should be cumulative progress towards an end goal, not per-month measurements. This gives a clear picture of overall project completion.",
      details: [
        "Track total features delivered, not monthly features",
        "Use cumulative test coverage, not weekly tests added",
        "Measure total story points completed vs. monthly velocity",
        "See the full journey towards your end goal"
      ],
      category: "best-practice"
    },
    {
      icon: <MdComment />,
      title: "Add Commentary for Adverse Metrics",
      description: "When metrics are red or amber, add commentary to explain why. This provides context for stakeholders and creates a record of issues and responses.",
      details: [
        "Explain root causes of delays or issues",
        "Document mitigation actions being taken",
        "Provide estimated recovery timelines",
        "Help stakeholders understand the full picture"
      ],
      category: "best-practice"
    },
    {
      icon: <MdTune />,
      title: "Review Your Tolerances",
      description: "Check that your amber and red thresholds are appropriate for each metric. Tolerances should reflect what's actually meaningful for your project.",
      details: [
        "Default 10%/20% may not suit all metrics",
        "Critical metrics might need tighter tolerances",
        "Some metrics naturally have more variance",
        "Adjust based on historical performance"
      ],
      category: "best-practice"
    },
    {
      icon: <MdShowChart />,
      title: "Choose Lead Metrics with Predictive Power",
      description: "Lead metrics should actually predict future outcomes. Ask: does this metric tell me if we'll succeed, or just if we're busy?",
      details: [
        "Good: Test coverage predicts defect rate",
        "Good: Sprint velocity predicts delivery date",
        "Poor: Hours worked doesn't predict quality",
        "Poor: Meetings held doesn't predict progress"
      ],
      category: "best-practice"
    },
    {
      icon: <MdLightbulb />,
      title: "Lag Measures Should Track Value Created",
      description: "Lag measures should track value delivered, not just work performed. Focus on outcomes that matter to your stakeholders.",
      details: [
        "Measure features delivered, not code written",
        "Track user adoption, not deployments",
        "Monitor quality metrics, not review counts",
        "Focus on what moves the needle"
      ],
      category: "best-practice"
    },
    // Feature tips from showreel
    {
      icon: <MdSpeed />,
      title: "Understand Status with Objective Measures",
      description: "Track your projects with quantifiable metrics instead of subjective assessments. Use real data to understand where your project stands.",
      details: [
        "Define custom metrics for each project",
        "Track actual vs. expected progress with RAG status",
        "Visualize trends over time with interactive charts",
        "Base decisions on data, not gut feeling"
      ],
      category: "feature"
    },
    {
      icon: <MdTimeline />,
      title: "Show Progress in Context of Scope Change",
      description: "Compare actual progress against expected trajectories, accounting for scope changes and schedule shifts.",
      details: [
        "Visualize expected progress curves",
        "Compare actual vs. planned trajectory",
        "Account for scope changes over time",
        "Understand if delays are due to scope or performance"
      ],
      category: "feature"
    },
    {
      icon: <MdFilterList />,
      title: "Focus on Metrics That Are Moving",
      description: "Quickly identify which metrics are changing and require attention. Filter out the noise and focus on what matters.",
      details: [
        "Highlight metrics with recent changes",
        "Filter by RAG status (Red, Amber, Green)",
        "Track rate of change and velocity",
        "Prioritize attention on problem areas"
      ],
      category: "feature"
    },
    {
      icon: <MdFolderSpecial />,
      title: "Organize Projects into Portfolios",
      description: "Group related projects together for better oversight. Manage multiple initiatives with portfolio-level views.",
      details: [
        "Create custom portfolios for different initiatives",
        "Assign color codes for easy identification",
        "Filter projects by portfolio",
        "Get portfolio-level consistency reports"
      ],
      category: "feature"
    },
    {
      icon: <MdCheckCircle />,
      title: "Run Consistency Checks",
      description: "Validate your metrics with automated consistency checks. Identify anomalies and data quality issues.",
      details: [
        "Detect velocity spikes during holiday periods",
        "Identify metrics with suspicious patterns",
        "Validate predictive measures against outcomes",
        "Ensure data quality and reliability"
      ],
      category: "feature"
    }
  ];

  const allFeatures = {
    "Core Tracking": [
      { icon: <MdSpeed />, name: "RAG Status Indicators", desc: "Visual Red/Amber/Green status on all metrics" },
      { icon: <MdTimeline />, name: "Progress Curves", desc: "Expected vs actual progress visualization" },
      { icon: <MdTrendingUp />, name: "Trend Analysis", desc: "Identify flat trajectories and changes" },
      { icon: <MdEdit />, name: "Inline Editing", desc: "Double-click to rename projects and metrics" },
      { icon: <MdTune />, name: "Tolerance Configuration", desc: "Adjust amber/red thresholds per metric" }
    ],
    "Data Management": [
      { icon: <MdList />, name: "Data Grid Editor", desc: "Spreadsheet-like interface for bulk updates" },
      { icon: <MdHistory />, name: "Time Travel", desc: "View historical data at any point in time" },
      { icon: <MdShare />, name: "Shareable Links", desc: "Direct URLs to specific projects and metrics" },
      { icon: <MdAssessment />, name: "Import/Export", desc: "CSV import and data export functionality" },
      { icon: <MdPictureAsPdf />, name: "PDF Export", desc: "Export metric charts with data tables" }
    ],
    "Collaboration": [
      { icon: <MdComment />, name: "PM Commentary", desc: "Add context and commentary to metrics" },
      { icon: <MdFeedback />, name: "Feedback Threads", desc: "Submit feedback and PM responses" },
      { icon: <MdLink />, name: "Project Links", desc: "Add external links to project resources" }
    ],
    "Organization": [
      { icon: <MdFolderSpecial />, name: "Portfolios", desc: "Group projects with color-coded portfolios" },
      { icon: <MdFilterList />, name: "Portfolio Filtering", desc: "View projects by portfolio" },
      { icon: <MdCheckCircle />, name: "Consistency Reports", desc: "Automated data quality checks" }
    ],
    "Security & Audit": [
      { icon: <MdSecurity />, name: "Role-Based Access", desc: "Admin, PM, Editor, and Viewer roles" },
      { icon: <MdHistory />, name: "Audit Log", desc: "Complete history of all changes" },
      { icon: <MdEdit />, name: "Historic Edit Protection", desc: "Prevent unauthorized changes to past data" }
    ]
  };

  const totalSlides = tips.length + 1; // +1 for the all features page

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleDotClick = (index) => {
    setCurrentSlide(index);
  };

  const handleDismiss = () => {
    if (onDismissPermanently) {
      onDismissPermanently();
    }
    onClose();
  };

  const isAllFeaturesPage = currentSlide === tips.length;
  const currentTip = isAllFeaturesPage ? null : tips[currentSlide];

  return (
    <div className="showreel-overlay" onClick={onClose}>
      <div className="showreel-modal" onClick={(e) => e.stopPropagation()}>
        <button className="showreel-close" onClick={onClose}>
          <MdClose />
        </button>

        <div className="showreel-content">
          {isAllFeaturesPage ? (
            <>
              <h2 className="showreel-title">All Features</h2>
              <div className="all-features-grid">
                {Object.entries(allFeatures).map(([category, features]) => (
                  <div key={category} className="feature-category">
                    <h3 className="category-title">{category}</h3>
                    <div className="category-features">
                      {features.map((feature, idx) => (
                        <div key={idx} className="feature-item">
                          <div className="feature-item-icon">{feature.icon}</div>
                          <div className="feature-item-content">
                            <div className="feature-item-name">{feature.name}</div>
                            <div className="feature-item-desc">{feature.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={`showreel-icon ${currentTip.category === 'best-practice' ? 'tip-icon' : ''}`}>
                {currentTip.icon}
              </div>

              {currentTip.category === 'best-practice' && (
                <span className="tip-badge">Best Practice</span>
              )}

              <h2 className="showreel-title">{currentTip.title}</h2>

              <p className="showreel-description">{currentTip.description}</p>

              <ul className="showreel-details">
                {currentTip.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </>
          )}

          <div className="showreel-progress">
            <span className="showreel-slide-counter">
              {currentSlide + 1} / {totalSlides}
            </span>
          </div>
        </div>

        <div className="showreel-navigation">
          <button
            className="showreel-nav-btn"
            onClick={handlePrev}
            disabled={currentSlide === 0}
          >
            <MdArrowBack />
          </button>

          <div className="showreel-dots">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                className={`showreel-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button
            className="showreel-nav-btn"
            onClick={handleNext}
            disabled={currentSlide === totalSlides - 1}
          >
            <MdArrowForward />
          </button>
        </div>

        <div className="tips-dismiss-section">
          <button className="dismiss-btn" onClick={handleDismiss}>
            Don't show on startup
          </button>
        </div>

        <div className="book-plug">
          <span>Inspired by </span>
          <a
            href="https://www.franklincovey.com/the-4-disciplines/"
            target="_blank"
            rel="noopener noreferrer"
          >
            The 4 Disciplines of Execution
          </a>
          <span> by McChesney, Covey & Huling</span>
        </div>
      </div>
    </div>
  );
};

export default TipsSplash;
