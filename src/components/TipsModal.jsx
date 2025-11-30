import React, { useState } from 'react';
import {
  MdLightbulb,
  MdFolderSpecial,
  MdShowChart,
  MdTimeline,
  MdTune,
  MdEdit,
  MdAssignment,
  MdDashboard,
  MdTrackChanges,
  MdTrendingUp,
  MdBuild,
  MdPeople,
  MdVisibility,
  MdFilterList,
  MdHistory,
  MdSpeed,
  MdViewWeek,
  MdWarning,
  MdComment,
  MdLink,
  MdCompareArrows,
  MdFlag,
  MdCheckCircle,
  MdFileDownload,
  MdAutorenew,
  MdEventNote,
  MdCalendarToday,
  MdNotifications
} from 'react-icons/md';

// Tips organized by theme
export const tipsByCategory = {
  "Best Practices": [
    {
      icon: <MdFolderSpecial />,
      title: "1. Create a Project",
      description: "Add a project to a portfolio giving it a description that clearly defines the business outcome you're tracking towards."
    },
    {
      icon: <MdShowChart />,
      title: "2. Define Your Metrics",
      description: "Define measures that move each reporting period (lead measures) and measures that demonstrate success (lag measures). Give them sensible names and describe precisely what they measure."
    },
    {
      icon: <MdTimeline />,
      title: "3. Set Expected Trajectories",
      description: "Describe the trajectory of these measures over time as an expected curve. This gives you a baseline to compare actual progress against."
    },
    {
      icon: <MdTune />,
      title: "4. Define Tolerances",
      description: "Set amber and red thresholds for deviation from the expected curve. This determines when metrics trigger warnings."
    },
    {
      icon: <MdEdit />,
      title: "5. Update Each Period",
      description: "Each reporting period, update the completed values for each metric. If these are out of tolerance, provide commentary explaining why and what you're doing about it."
    },
    {
      icon: <MdAssignment />,
      title: "6. Create Recovery Plans",
      description: "When metrics go red, create recovery plans with specific actions and dates. Track these through to completion."
    },
    {
      icon: <MdDashboard />,
      title: "7. Monitor the Dashboard",
      description: "Keep an eye on the consistency panel of the home page for data quality issues. Use filters to focus on what needs attention."
    }
  ],
  "Purpose": [
    {
      icon: <MdTrackChanges />,
      title: "Objective Status Measurement",
      description: "Replace subjective RAG assessments with data-driven metrics. Know exactly where you stand, not where someone thinks you stand."
    },
    {
      icon: <MdTrendingUp />,
      title: "Predict, Don't Explain",
      description: "Focus on whether you'll hit your dates, not why you missed them. Early warning beats post-mortem analysis."
    },
    {
      icon: <MdBuild />,
      title: "Course Correct as You Go",
      description: "When metrics show you're off track, create recovery plans immediately. Small adjustments now prevent big problems later."
    },
    {
      icon: <MdPeople />,
      title: "Meaningful to Everyone",
      description: "Progress described in ways that executives, stakeholders, and team members all understand. One version of the truth."
    },
    {
      icon: <MdDashboard />,
      title: "Everything in One Place",
      description: "All projects, metrics, commentary, and recovery plans in a single system. No more scattered spreadsheets and status emails."
    },
    {
      icon: <MdVisibility />,
      title: "Transparency Builds Trust",
      description: "When everyone sees the same data, conversations shift from blame to problem-solving. Bad news travels fast, enabling faster fixes."
    }
  ],
  "Metric Design": [
    {
      icon: <MdTrackChanges />,
      title: "Use Cumulative Metrics",
      description: "Metrics should be cumulative progress towards an end goal, not per-month measurements."
    },
    {
      icon: <MdShowChart />,
      title: "Choose Lead Metrics with Predictive Power",
      description: "Lead metrics should actually predict future outcomes, not just measure activity."
    },
    {
      icon: <MdLightbulb />,
      title: "Lag Measures Should Track Value",
      description: "Focus on outcomes that matter - features delivered, not code written."
    },
    {
      icon: <MdTune />,
      title: "Review Your Tolerances",
      description: "Check that your amber and red thresholds are appropriate for each metric."
    },
    {
      icon: <MdSpeed />,
      title: "Use Progression Curves",
      description: "S-curves for ramp-up projects, linear for steady work, exponential for growth metrics."
    },
    {
      icon: <MdViewWeek />,
      title: "Choose the Right Frequency",
      description: "Match reporting frequency to the metric's natural cadence - weekly for fast-moving, monthly for stable."
    },
    {
      icon: <MdLightbulb />,
      title: "Quality Over Quantity",
      description: "A few well-chosen metrics tell a better story than many mediocre ones."
    },
    {
      icon: <MdTrendingUp />,
      title: "Focus on Variance, Not Absolutes",
      description: "The percentage behind schedule matters more than the absolute number."
    }
  ],
  "Tracking & Visualization": [
    {
      icon: <MdTimeline />,
      title: "Show Progress in Context",
      description: "Compare actual progress against expected trajectories, accounting for scope changes."
    },
    {
      icon: <MdFilterList />,
      title: "Focus on Metrics That Are Moving",
      description: "Filter by RAG status to prioritize attention on problem areas."
    },
    {
      icon: <MdHistory />,
      title: "Use Time Travel to Review History",
      description: "View your metrics as they appeared at any past date to understand trends and changes."
    },
    {
      icon: <MdEdit />,
      title: "Click to Edit Any Value",
      description: "Click directly on any cell in the metric chart to edit values inline - no modal needed."
    },
    {
      icon: <MdDashboard />,
      title: "Use the Dashboard Daily",
      description: "Start your day by checking the dashboard to see what needs attention."
    },
    {
      icon: <MdVisibility />,
      title: "Make Progress Visible",
      description: "Share dashboards with stakeholders to build trust and transparency."
    },
    {
      icon: <MdWarning />,
      title: "Don't Ignore Amber Metrics",
      description: "Amber is an early warning - address issues before they turn red."
    },
    {
      icon: <MdTrendingUp />,
      title: "Celebrate Green Metrics",
      description: "Recognize success when metrics are on track - it motivates teams to maintain momentum."
    }
  ],
  "Communication & Documentation": [
    {
      icon: <MdComment />,
      title: "Add Commentary for Adverse Metrics",
      description: "When metrics are red or amber, add commentary to explain why and document mitigation actions."
    },
    {
      icon: <MdComment />,
      title: "Keep Commentary Concise",
      description: "Good commentary explains why you're behind and what you're doing about it in 2-3 sentences."
    },
    {
      icon: <MdAssignment />,
      title: "Document Assumptions",
      description: "Record the assumptions behind your targets - they're valuable when scope changes."
    },
    {
      icon: <MdLink />,
      title: "Link to Project Documentation",
      description: "Add links to your project's SharePoint, Confluence, or documentation hub for easy access."
    },
    {
      icon: <MdDashboard />,
      title: "Connect Power BI Dashboards",
      description: "Link to your Power BI reports and dashboards for deeper data analysis and visualization."
    },
    {
      icon: <MdAssignment />,
      title: "Link to Jira Dashboards",
      description: "Connect to your Jira boards and dashboards to see sprint progress alongside your metrics."
    },
    {
      icon: <MdTimeline />,
      title: "Add Navigator Links",
      description: "Link to your team's Navigator roadmaps to provide strategic context for your metrics."
    },
    {
      icon: <MdFolderSpecial />,
      title: "Centralize Key Resources",
      description: "Use project links to create a single source of truth for all your project's key tools and resources."
    }
  ],
  "Organization & Governance": [
    {
      icon: <MdFolderSpecial />,
      title: "Organize Projects into Portfolios",
      description: "Group related projects together for better oversight and portfolio-level views."
    },
    {
      icon: <MdFilterList />,
      title: "Use Portfolio Filters",
      description: "Filter the consistency report by portfolio to focus on specific business areas."
    },
    {
      icon: <MdCompareArrows />,
      title: "Compare Projects Side by Side",
      description: "Use portfolio views to compare similar projects and identify best practices."
    },
    {
      icon: <MdLink />,
      title: "Link Related Projects",
      description: "Connect projects that depend on each other using project links to track dependencies."
    },
    {
      icon: <MdFlag />,
      title: "Track CRAIDs for Governance",
      description: "Log Comments, Risks, Actions, Issues, and Dependencies for complete project oversight."
    },
    {
      icon: <MdPeople />,
      title: "Assign Metric Owners",
      description: "Make metrics actionable by assigning owners who are accountable for progress."
    },
    {
      icon: <MdCheckCircle />,
      title: "Run Consistency Checks",
      description: "Use automated consistency reports to identify anomalies and data quality issues."
    },
    {
      icon: <MdFileDownload />,
      title: "Export for Offline Analysis",
      description: "Download your data as Excel files for presentations or offline analysis."
    }
  ],
  "Data Management": [
    {
      icon: <MdAutorenew />,
      title: "Adjust Targets Mid-Stream",
      description: "When scope changes, update targets while preserving historical expected values."
    },
    {
      icon: <MdTimeline />,
      title: "Extend End Dates When Needed",
      description: "Click the project dates to extend timelines - periods will auto-generate to cover the new range."
    },
    {
      icon: <MdEventNote />,
      title: "Update Metrics on Schedule",
      description: "Set reminders to update metrics consistently - stale data is worse than no data."
    },
    {
      icon: <MdCalendarToday />,
      title: "Match Periods to Reviews",
      description: "Align reporting periods with your governance cadence - weekly, monthly, or quarterly."
    },
    {
      icon: <MdBuild />,
      title: "Start Small, Iterate",
      description: "Begin with 2-3 key metrics per project - you can always add more later."
    },
    {
      icon: <MdNotifications />,
      title: "Set Up Alerts",
      description: "Use consistency reports to catch data issues before they become problems."
    }
  ]
};

// Get all tips flattened for random selection
export const getAllTips = () => Object.values(tipsByCategory).flat();

const TipsModal = ({ isOpen, onClose, selectedCategory, onSelectCategory }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content tips-modal-tabbed">
        <div className="modal-header">
          <MdLightbulb className="modal-icon" />
          <h2>Purpose & Best Practices</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tips-tabs">
          {Object.keys(tipsByCategory).map((category) => (
            <button
              key={category}
              className={`tips-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => onSelectCategory(selectedCategory === category ? null : category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="modal-body tips-tabbed-content">
          {selectedCategory && tipsByCategory[selectedCategory] ? (
            <div className="tips-grid">
              {tipsByCategory[selectedCategory].map((tip, index) => (
                <div key={index} className="modal-tip-card">
                  <div className="tip-icon-wrapper">{tip.icon}</div>
                  <div className="tip-content">
                    <h4 className="tip-title">{tip.title}</h4>
                    <p className="tip-description">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tips-select-prompt">
              <MdLightbulb className="prompt-icon" />
              <p>Select a category above to view tips</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TipsModal;
