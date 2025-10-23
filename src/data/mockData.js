// Mock data structure for progress tracking
export const mockProjects = {
  'project-alpha': {
    name: 'Project Alpha - Infrastructure Modernization',
    initiatives: [
      // Server Migration - 10 periods (Realistic: slow start, varied progress, catch-up at end)
      { id: 1, reporting_date: '2024-01-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 10, final_target: 100, complete: 5, commentary: '' },
      { id: 2, reporting_date: '2024-02-29', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 20, final_target: 101, complete: 12, commentary: 'Resource constraints identified. Two senior engineers allocated to accelerate progress.' },
      { id: 3, reporting_date: '2024-03-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 30, final_target: 103, complete: 19, commentary: '' },
      { id: 4, reporting_date: '2024-04-30', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 40, final_target: 104, complete: 28, commentary: 'Discovery of 4 additional legacy servers requiring migration. Scope updated.' },
      { id: 5, reporting_date: '2024-05-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 50, final_target: 105, complete: 41, commentary: '' },
      { id: 6, reporting_date: '2024-06-30', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 60, final_target: 105, complete: 54, commentary: '' },
      { id: 7, reporting_date: '2024-07-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 70, final_target: 105, complete: 69, commentary: 'Parallel migration streams established. Progress accelerating as team gains experience.' },
      { id: 8, reporting_date: '2024-08-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 80, final_target: 105, complete: 82, commentary: '' },
      { id: 9, reporting_date: '2024-09-30', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 90, final_target: 105, complete: 94, commentary: '' },
      { id: 10, reporting_date: '2024-10-31', initiative: 'Infrastructure Modernization', metric: 'Server Migration', type: 'action', owner: 'Sarah Chen', initiative_manager: 'David Roberts', expected: 100, final_target: 105, complete: 105, commentary: 'Migration completed successfully. All servers now on new infrastructure with improved performance monitoring.' },

      // Database Upgrades - 9 periods (Variable progress, sometimes ahead, sometimes behind)
      { id: 11, reporting_date: '2024-02-29', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 10, final_target: 80, complete: 7, commentary: '' },
      { id: 12, reporting_date: '2024-03-31', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 20, final_target: 82, complete: 15, commentary: 'Vendor support delays for legacy database versions impacting upgrade timeline.' },
      { id: 13, reporting_date: '2024-04-30', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 30, final_target: 83, complete: 24, commentary: '' },
      { id: 14, reporting_date: '2024-05-31', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 40, final_target: 84, complete: 37, commentary: '' },
      { id: 15, reporting_date: '2024-06-30', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 50, final_target: 84, complete: 48, commentary: 'Performance testing showing 40% improvement. Additional schema optimization opportunities identified.' },
      { id: 16, reporting_date: '2024-07-31', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 60, final_target: 84, complete: 57, commentary: '' },
      { id: 17, reporting_date: '2024-08-31', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 70, final_target: 84, complete: 68, commentary: '' },
      { id: 18, reporting_date: '2024-09-30', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 80, final_target: 84, complete: 77, commentary: '' },
      { id: 19, reporting_date: '2024-10-31', initiative: 'Infrastructure Modernization', metric: 'Database Upgrades', type: 'action', owner: 'James Kumar', initiative_manager: 'David Roberts', expected: 84, final_target: 84, complete: 84, commentary: '' },

      // Security Patching - Risk tracking (Some months exceed plan, others lag)
      { id: 20, reporting_date: '2024-01-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 12, final_target: 120, complete: 9, commentary: 'Initial vulnerability assessment complete. Prioritizing critical CVEs.' },
      { id: 21, reporting_date: '2024-02-29', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 24, final_target: 122, complete: 18, commentary: '' },
      { id: 22, reporting_date: '2024-03-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 36, final_target: 122, complete: 31, commentary: '' },
      { id: 23, reporting_date: '2024-04-30', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 48, final_target: 122, complete: 46, commentary: 'Emergency patch cycle for zero-day vulnerability consumed resources but now back on track.' },
      { id: 24, reporting_date: '2024-05-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 60, final_target: 122, complete: 59, commentary: '' },
      { id: 25, reporting_date: '2024-06-30', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 72, final_target: 122, complete: 73, commentary: 'Ahead of schedule. Automated patching pipeline delivering efficiency gains.' },
      { id: 26, reporting_date: '2024-07-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 84, final_target: 122, complete: 87, commentary: '' },
      { id: 27, reporting_date: '2024-08-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 96, final_target: 122, complete: 99, commentary: '' },
      { id: 28, reporting_date: '2024-09-30', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 108, final_target: 122, complete: 111, commentary: '' },
      { id: 29, reporting_date: '2024-10-31', initiative: 'Infrastructure Modernization', metric: 'Security Patching', type: 'risk', owner: 'Mike Zhang', initiative_manager: 'David Roberts', expected: 120, final_target: 122, complete: 122, commentary: 'All critical and high vulnerabilities patched. Continuous monitoring in place.' },
    ]
  },
  'project-beta': {
    name: 'Project Beta - Customer Experience',
    initiatives: [
      // UI Redesign - Varying increments, crosses plan line
      { id: 30, reporting_date: '2024-01-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 5, final_target: 60, complete: 3, commentary: '' },
      { id: 31, reporting_date: '2024-02-29', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 10, final_target: 62, complete: 7, commentary: 'Design system foundation established. Component library started.' },
      { id: 32, reporting_date: '2024-03-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 17, final_target: 63, complete: 13, commentary: '' },
      { id: 33, reporting_date: '2024-04-30', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 26, final_target: 64, complete: 22, commentary: '' },
      { id: 34, reporting_date: '2024-05-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 37, final_target: 65, complete: 34, commentary: 'User testing feedback incorporated. Additional accessibility screens added to scope.' },
      { id: 35, reporting_date: '2024-06-30', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 48, final_target: 65, complete: 47, commentary: '' },
      { id: 36, reporting_date: '2024-07-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 56, final_target: 65, complete: 57, commentary: 'Mobile responsive designs completed ahead of schedule.' },
      { id: 37, reporting_date: '2024-08-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 61, final_target: 65, complete: 63, commentary: '' },
      { id: 38, reporting_date: '2024-09-30', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 64, final_target: 65, complete: 65, commentary: 'All screens redesigned and approved. Ready for implementation phase.' },
      { id: 39, reporting_date: '2024-10-31', initiative: 'Customer Experience', metric: 'UI Redesign', type: 'action', owner: 'Lisa Park', initiative_manager: 'Emma Thompson', expected: 65, final_target: 65, complete: 65, commentary: '' },

      // Performance Optimization - Uneven progress with spurts
      { id: 40, reporting_date: '2024-02-29', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 11, final_target: 95, complete: 8, commentary: '' },
      { id: 41, reporting_date: '2024-03-31', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 22, final_target: 96, complete: 17, commentary: 'Initial profiling complete. Identified key bottlenecks in data loading.' },
      { id: 42, reporting_date: '2024-04-30', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 33, final_target: 97, complete: 28, commentary: '' },
      { id: 43, reporting_date: '2024-05-31', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 44, final_target: 98, complete: 39, commentary: '' },
      { id: 44, reporting_date: '2024-06-30', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 55, final_target: 98, complete: 53, commentary: '' },
      { id: 45, reporting_date: '2024-07-31', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 66, final_target: 98, complete: 66, commentary: 'CDN implementation delivering 60% reduction in page load times.' },
      { id: 46, reporting_date: '2024-08-31', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 77, final_target: 98, complete: 78, commentary: '' },
      { id: 47, reporting_date: '2024-09-30', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 88, final_target: 98, complete: 90, commentary: '' },
      { id: 48, reporting_date: '2024-10-31', initiative: 'Customer Experience', metric: 'Performance Optimization', type: 'action', owner: 'Tom Wilson', initiative_manager: 'Emma Thompson', expected: 98, final_target: 98, complete: 98, commentary: '' },
    ]
  }
};

// Helper function to get unique metrics for a project
export const getMetricsForProject = (projectKey) => {
  const project = mockProjects[projectKey];
  if (!project) return [];

  const metrics = [...new Set(project.initiatives.map(item => item.metric))];
  return metrics;
};

// Helper function to get data for a specific metric
export const getDataForMetric = (projectKey, metric) => {
  const project = mockProjects[projectKey];
  if (!project) return [];

  return project.initiatives.filter(item => item.metric === metric);
};
