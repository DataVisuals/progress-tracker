import React from 'react';
import { MdGridView, MdFeedback, MdWarning, MdFlag } from 'react-icons/md';
import './ProjectTabs.css';

const ProjectTabs = ({
  selectedTab,
  onTabChange,
  feedbackCount = 0,
  recoveryPlanCount = 0,
  milestonesCount = 0,
  needsRecoveryPlan = false,
  currentUser
}) => {
  const allTabs = [
    {
      id: 'overview',
      label: 'Metrics',
      icon: <MdGridView />
    },
    {
      id: 'milestones',
      label: 'Milestones',
      icon: <MdFlag />,
      badge: milestonesCount > 0 ? milestonesCount : null,
      adminOnly: true
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: <MdFeedback />,
      badge: feedbackCount > 0 ? feedbackCount : null
    },
    {
      id: 'recovery',
      label: 'Recovery Plans',
      icon: <MdWarning />,
      badge: recoveryPlanCount > 0 ? recoveryPlanCount : null
    }
  ];

  // Filter tabs based on user role
  const tabs = allTabs.filter(tab => {
    if (tab.adminOnly && currentUser?.role === 'viewer') {
      return false;
    }
    return true;
  });

  return (
    <div className="project-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`project-tab ${selectedTab === tab.id ? 'active' : ''} ${tab.id === 'recovery' && needsRecoveryPlan ? 'needs-action' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={tab.id === 'recovery' && needsRecoveryPlan ? 'Recovery plan needed for delinquent metric' : ''}
        >
          {tab.icon}
          <span className="project-tab-label">{tab.label}</span>
          {tab.badge && <span className="project-tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
};

export default ProjectTabs;
