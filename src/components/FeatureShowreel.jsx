import React, { useState } from 'react';
import {
  MdClose,
  MdArrowBack,
  MdArrowForward,
  MdSpeed,
  MdTimeline,
  MdTrendingUp,
  MdFilterList,
  MdFolderSpecial,
  MdCheckCircle
} from 'react-icons/md';
import './FeatureShowreel.css';

const FeatureShowreel = ({ onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const features = [
    {
      icon: <MdSpeed />,
      title: "Understand Project Status Using Objective Measures",
      description: "Track your projects with quantifiable metrics instead of subjective assessments. Use real data to understand where your project stands at any moment.",
      details: [
        "Define custom metrics for each project",
        "Track actual vs. expected progress with RAG status",
        "Visualize trends over time with interactive charts",
        "Base decisions on data, not gut feeling"
      ]
    },
    {
      icon: <MdTimeline />,
      title: "Show Progress in Context of Scope Change",
      description: "See how your project is really progressing by comparing actual progress against expected trajectories, accounting for scope changes and schedule shifts.",
      details: [
        "Visualize expected progress curves",
        "Compare actual vs. planned trajectory",
        "Account for scope changes over time",
        "Understand if delays are due to scope or performance"
      ]
    },
    {
      icon: <MdTrendingUp />,
      title: "Use Key Lead and Lag Measures",
      description: "Track both leading indicators (predictive) and lagging indicators (outcome-based) to get a complete picture of project health and future performance.",
      details: [
        "Define leading measures (e.g., velocity, test coverage)",
        "Track lagging measures (e.g., delivery, defects)",
        "Balance short-term and long-term indicators",
        "Predict future outcomes with leading metrics"
      ]
    },
    {
      icon: <MdFilterList />,
      title: "Focus on Measures That Are Moving",
      description: "Quickly identify which metrics are changing and require attention. Filter out the noise and focus on what matters most for your project status.",
      details: [
        "Highlight metrics with recent changes",
        "Filter by RAG status (Red, Amber, Green)",
        "Track rate of change and velocity",
        "Prioritize attention on problem areas"
      ]
    },
    {
      icon: <MdFolderSpecial />,
      title: "Organize Projects into Portfolios",
      description: "Group related projects together for better oversight. Manage multiple initiatives with portfolio-level views and color-coded organization.",
      details: [
        "Create custom portfolios for different initiatives",
        "Assign color codes for easy identification",
        "Filter projects by portfolio",
        "Get portfolio-level consistency reports"
      ]
    },
    {
      icon: <MdCheckCircle />,
      title: "Assess All Measures for Consistency",
      description: "Validate your metrics with automated consistency checks. Identify anomalies like velocity during holidays or suspicious patterns that might indicate data quality issues.",
      details: [
        "Detect velocity spikes during holiday periods",
        "Identify metrics with suspicious patterns",
        "Validate predictive measures against outcomes",
        "Get consistency scores across all projects",
        "Ensure data quality and reliability"
      ]
    }
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % features.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + features.length) % features.length);
  };

  const handleDotClick = (index) => {
    setCurrentSlide(index);
  };

  const currentFeature = features[currentSlide];

  return (
    <div className="showreel-overlay" onClick={onClose}>
      <div className="showreel-modal" onClick={(e) => e.stopPropagation()}>
        <button className="showreel-close" onClick={onClose}>
          <MdClose />
        </button>

        <div className="showreel-content">
          <div className="showreel-icon">
            {currentFeature.icon}
          </div>

          <h2 className="showreel-title">{currentFeature.title}</h2>

          <p className="showreel-description">{currentFeature.description}</p>

          <ul className="showreel-details">
            {currentFeature.details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>

          <div className="showreel-progress">
            <span className="showreel-slide-counter">
              {currentSlide + 1} / {features.length}
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
            {features.map((_, index) => (
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
            disabled={currentSlide === features.length - 1}
          >
            <MdArrowForward />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureShowreel;
