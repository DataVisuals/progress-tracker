import {
  MdVisibility,
  MdFlag,
  MdComment,
  MdBuild,
  MdFavorite,
  MdHistory,
  MdPeople,
  MdDirectionsRun,
  MdDateRange,
  MdFiberNew,
  MdPendingActions,
  MdCleaningServices
} from 'react-icons/md';
import { FaDatabase } from 'react-icons/fa';

// Panel configuration - defines all available panels
// Order determines dock display order (inconsistencies first, then timeline, health, etc.)
export const PANEL_CONFIG = {
  inconsistencies: { id: 'inconsistencies', name: 'Inconsistencies', shortLabel: 'Clean Up', icon: MdCleaningServices, adminOnly: false },
  timeline: { id: 'timeline', name: 'Project Timeline', shortLabel: 'Timeline', icon: MdDateRange, adminOnly: false, dockOnly: true },
  projectHealth: { id: 'projectHealth', name: 'Project Health Rankings', shortLabel: 'Health', icon: MdFavorite, adminOnly: false },
  heatmap: { id: 'heatmap', name: 'Most Viewed Projects', shortLabel: 'Views', icon: MdVisibility, adminOnly: false },
  metrics: { id: 'metrics', name: 'Metrics at Risk', shortLabel: 'Issues', icon: MdFlag, adminOnly: false },
  commentary: { id: 'commentary', name: 'Recent Commentary', shortLabel: 'Comments', icon: MdComment, adminOnly: false },
  recentUpdates: { id: 'recentUpdates', name: 'Recent Updates', shortLabel: 'Updates', icon: MdFiberNew, adminOnly: false },
  attention: { id: 'attention', name: 'My Projects Needing Attention', shortLabel: 'Attention', icon: MdBuild, adminOnly: false, hiddenFromDock: true },
  backlog: { id: 'backlog', name: 'Project Backlog', shortLabel: 'Backlog', icon: MdPendingActions, adminOnly: false },
  audit: { id: 'audit', name: 'Audit Log', shortLabel: 'Audit', icon: MdHistory, adminOnly: true },
  activeUsers: { id: 'activeUsers', name: 'User Insights', shortLabel: 'Users', icon: MdPeople, adminOnly: true },
  performance: { id: 'performance', name: 'Performance', shortLabel: 'Perf', icon: MdDirectionsRun, adminOnly: true }
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
  panels: ['inconsistencies', 'projectHealth', 'heatmap', 'commentary']
};
