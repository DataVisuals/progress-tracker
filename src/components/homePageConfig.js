import {
  MdVisibility,
  MdSpeed,
  MdComment,
  MdBugReport,
  MdBuild,
  MdFavorite,
  MdHistory,
  MdStorage,
  MdPeople
} from 'react-icons/md';

// Panel configuration - defines all available panels
export const PANEL_CONFIG = {
  heatmap: { id: 'heatmap', name: 'Most Viewed Projects', icon: MdVisibility, adminOnly: false },
  metrics: { id: 'metrics', name: 'Metrics at Risk', icon: MdSpeed, adminOnly: false },
  commentary: { id: 'commentary', name: 'Recent Commentary', icon: MdComment, adminOnly: false },
  inconsistencies: { id: 'inconsistencies', name: 'Inconsistencies', icon: MdBugReport, adminOnly: false },
  attention: { id: 'attention', name: 'My Projects Needing Attention', icon: MdBuild, adminOnly: false },
  projectHealth: { id: 'projectHealth', name: 'Project Health Rankings', icon: MdFavorite, adminOnly: false },
  audit: { id: 'audit', name: 'Audit Log', icon: MdHistory, adminOnly: true },
  database: { id: 'database', name: 'Database Stats', icon: MdStorage, adminOnly: true },
  activeUsers: { id: 'activeUsers', name: 'Active Users', icon: MdPeople, adminOnly: true }
};

// Layout configurations
export const LAYOUT_CONFIG = {
  '2x2': { name: '2x2 Grid', panelCount: 4, cssClass: 'layout-2x2' },
  '2x1': { name: '2 Columns', panelCount: 2, cssClass: 'layout-2x1' },
  '1x2': { name: '2 Rows', panelCount: 2, cssClass: 'layout-1x2' },
  '1x1': { name: 'Single Panel', panelCount: 1, cssClass: 'layout-1x1' },
  '2x2-1x1': { name: '2x2 + Full Width', panelCount: 5, cssClass: 'layout-2x2-1x1' },
  '3x2': { name: '3x2 Grid', panelCount: 6, cssClass: 'layout-3x2' }
};

// Default dashboard configuration
export const DEFAULT_DASHBOARD_CONFIG = {
  layout: '2x2',
  panels: ['heatmap', 'metrics', 'commentary', 'inconsistencies']
};
