import React from 'react';
import {
  MdClose,
  MdHome,
  MdAssessment,
  MdFeedback,
  MdEdit,
  MdTimeline,
  MdFolderSpecial,
  MdFileUpload,
  MdLink,
  MdHistory,
  MdSecurity
} from 'react-icons/md';
import './WhatsNew.css';

const WhatsNew = ({ onClose }) => {
  const features = [
    {
      icon: <MdHome />,
      title: "Dashboard Homepage",
      date: "November 2025",
      description: "New 4-quadrant dashboard showing quick overview, metrics at risk, recent commentary, and tips & best practices.",
      highlights: [
        "At-a-glance project health summary",
        "Metrics requiring attention highlighted",
        "Recent activity and commentary feed",
        "Personalized feedback section"
      ]
    },
    {
      icon: <MdAssessment />,
      title: "User Activity Report",
      date: "November 2025",
      description: "Comprehensive activity tracking for administrators to monitor user engagement and system usage.",
      highlights: [
        "Track login patterns and frequency",
        "Monitor project and metric updates",
        "View commentary and feedback activity",
        "Admin-only access with role-based security"
      ]
    },
    {
      icon: <MdFeedback />,
      title: "Project Feedback System",
      date: "November 2025",
      description: "Built-in feedback mechanism allowing stakeholders to provide input on projects with PM responses.",
      highlights: [
        "Submit feedback on specific projects",
        "PM can respond and resolve feedback",
        "Track resolved status with timestamps",
        "Project-specific feedback filtering"
      ]
    },
    {
      icon: <MdEdit />,
      title: "Metric Editing & Management",
      date: "November 2025",
      description: "Enhanced metric management with inline editing, custom curves, and automatic period extensions.",
      highlights: [
        "Edit metric details and descriptions",
        "Custom progression curve detection",
        "Automatic end date extension",
        "Delete metrics with dropdown menu"
      ]
    },
    {
      icon: <MdTimeline />,
      title: "Interim Period Support",
      date: "November 2025",
      description: "Add interim reporting periods between scheduled periods for more granular tracking.",
      highlights: [
        "Insert periods at any point",
        "PM role can edit historic data",
        "Maintains data integrity",
        "Flexible reporting cadence"
      ]
    },
    {
      icon: <MdFolderSpecial />,
      title: "Portfolio Status Report",
      date: "November 2025",
      description: "Portfolio-level reporting with aggregated metrics and cross-project insights.",
      highlights: [
        "Portfolio-wide health overview",
        "Color-coded visual organization",
        "Filter by portfolio",
        "Change project portfolios post-creation"
      ]
    },
    {
      icon: <MdFileUpload />,
      title: "Excel Import Feature",
      date: "October 2025",
      description: "Bulk import project data using Excel templates for efficient data migration and updates.",
      highlights: [
        "Template-based import",
        "Bulk project and metric updates",
        "Validation and error checking",
        "Downloadable import template"
      ]
    },
    {
      icon: <MdLink />,
      title: "External Project Links",
      date: "October 2025",
      description: "Add and manage external links to project resources like Jira, SharePoint, or documentation.",
      highlights: [
        "Multiple links per project",
        "Edit and delete functionality",
        "Quick access to external tools",
        "Centralized resource hub"
      ]
    },
    {
      icon: <MdHistory />,
      title: "Time Travel & Historic Protection",
      date: "October 2025",
      description: "View historical data at any point in time with protection against unauthorized historic edits.",
      highlights: [
        "View data as it appeared on any date",
        "Historic edit protection",
        "Audit trail preservation",
        "Data integrity controls"
      ]
    },
    {
      icon: <MdSecurity />,
      title: "Role-Based Access Control",
      date: "October 2025",
      description: "Comprehensive security with Admin, PM, Editor, and Viewer roles with granular permissions.",
      highlights: [
        "Four distinct user roles",
        "Permission-based UI customization",
        "Password management",
        "User profile editing"
      ]
    }
  ];

  return (
    <div className="whatsnew-overlay" onClick={onClose}>
      <div className="whatsnew-modal" onClick={(e) => e.stopPropagation()}>
        <button className="whatsnew-close" onClick={onClose}>
          <MdClose />
        </button>

        <div className="whatsnew-header">
          <h2>What's New</h2>
          <p className="whatsnew-subtitle">Recent features and improvements</p>
        </div>

        <div className="whatsnew-content">
          {features.map((feature, index) => (
            <div key={index} className="whatsnew-item">
              <div className="whatsnew-item-header">
                <div className="whatsnew-icon">{feature.icon}</div>
                <div className="whatsnew-title-section">
                  <h3 className="whatsnew-title">{feature.title}</h3>
                  <span className="whatsnew-date">{feature.date}</span>
                </div>
              </div>
              <p className="whatsnew-description">{feature.description}</p>
              <ul className="whatsnew-highlights">
                {feature.highlights.map((highlight, idx) => (
                  <li key={idx}>{highlight}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhatsNew;
