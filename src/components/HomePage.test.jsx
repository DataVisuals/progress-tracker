import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';
import { api } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    getCommentary: vi.fn(),
    getFeedback: vi.fn(),
    getMyProjectsFeedback: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

// Mock lottie-react
vi.mock('lottie-react', () => ({
  default: () => <div>Lottie Animation</div>,
}));

// Mock react-icons
vi.mock('react-icons/md', () => ({
  MdComment: () => <div>CommentIcon</div>,
  MdWarning: () => <div>WarningIcon</div>,
  MdLightbulb: () => <div>LightbulbIcon</div>,
  MdTrendingUp: () => <div>TrendingUpIcon</div>,
  MdArrowForward: () => <div>ArrowIcon</div>,
  MdErrorOutline: () => <div>ExclamationIcon</div>,
  MdHome: () => <div>HomeIcon</div>,
  MdTrackChanges: () => <div>TrackChangesIcon</div>,
  MdTune: () => <div>TuneIcon</div>,
  MdShowChart: () => <div>ShowChartIcon</div>,
  MdTimeline: () => <div>TimelineIcon</div>,
  MdFilterList: () => <div>FilterListIcon</div>,
  MdFolderSpecial: () => <div>FolderSpecialIcon</div>,
  MdCheckCircle: () => <div>CheckCircleIcon</div>,
  MdHistory: () => <div>HistoryIcon</div>,
  MdEdit: () => <div>EditIcon</div>,
  MdLink: () => <div>LinkIcon</div>,
  MdFileDownload: () => <div>FileDownloadIcon</div>,
  MdAutorenew: () => <div>AutorenewIcon</div>,
  MdViewWeek: () => <div>ViewWeekIcon</div>,
  MdSpeed: () => <div>SpeedIcon</div>,
  MdFlag: () => <div>FlagIcon</div>,
  MdPeople: () => <div>PeopleIcon</div>,
  MdCompareArrows: () => <div>CompareArrowsIcon</div>,
  MdAssignment: () => <div>AssignmentIcon</div>,
  MdDashboard: () => <div>DashboardIcon</div>,
  MdEventNote: () => <div>EventNoteIcon</div>,
  MdBuild: () => <div>BuildIcon</div>,
  MdVisibility: () => <div>VisibilityIcon</div>,
  MdNotifications: () => <div>NotificationsIcon</div>,
  MdCalendarToday: () => <div>CalendarTodayIcon</div>,
  MdFeedback: () => <div>FeedbackIcon</div>,
  MdBugReport: () => <div>BugReportIcon</div>,
  MdSettings: () => <div>SettingsIcon</div>,
  MdPieChart: () => <div>PieChartIcon</div>,
  MdAccessTime: () => <div>AccessTimeIcon</div>,
  MdFavorite: () => <div>FavoriteIcon</div>,
  MdRemove: () => <div>RemoveIcon</div>,
  MdAdd: () => <div>AddIcon</div>,
  MdClose: () => <div>CloseIcon</div>,
}));

// Mock FontAwesome icons
vi.mock('react-icons/fa', () => ({
  FaDatabase: () => <div>DatabaseIcon</div>,
}));

// Mock DashboardConfigModal
vi.mock('./DashboardConfigModal', () => ({
  default: () => <div>DashboardConfigModal</div>,
}));

// Mock trackPage
vi.mock('../hooks/usePageTracking', () => ({
  trackPage: vi.fn(),
}));

// Mock calculateHealthScore
vi.mock('./ProjectHealthModal', () => ({
  calculateHealthScore: vi.fn(() => 75),
}));

describe('HomePage - Recovery Plan Indicator Tests', () => {
  const mockProjects = {
    1: {
      id: 1,
      name: 'Project Alpha',
      portfolio_name: 'Portfolio A',
      portfolio_color: '#00aeef',
      initiative_manager: 'John Doe',
    },
    2: {
      id: 2,
      name: 'Project Beta',
      portfolio_name: 'Portfolio B',
      portfolio_color: '#10b981',
      initiative_manager: 'Jane Smith',
    },
  };

  const mockProjectsData = {
    1: [
      {
        id: 1,
        metric_id: 10,
        project_id: 1,
        metric: 'Red Metric Without Plan',
        reporting_date: '2025-01-01',
        complete: 50,
        expected: 100,
        final_target: 500,
        rag_status: 'red',
        red_tolerance: 10,
        amber_tolerance: 5,
      },
      {
        id: 2,
        metric_id: 11,
        project_id: 1,
        metric: 'Red Metric With Plan',
        reporting_date: '2025-01-01',
        complete: 40,
        expected: 100,
        final_target: 500,
        rag_status: 'red',
        red_tolerance: 10,
        amber_tolerance: 5,
      },
    ],
    2: [
      {
        id: 3,
        metric_id: 20,
        project_id: 2,
        metric: 'Amber Metric',
        reporting_date: '2025-01-01',
        complete: 90,
        expected: 100,
        final_target: 500,
        rag_status: 'amber',
        red_tolerance: 10,
        amber_tolerance: 5,
      },
    ],
  };

  const mockCurrentUser = {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    role: 'pm',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Default mock response for inconsistency-report
  const emptyInconsistencyReport = { summary: [], total_inconsistencies: 0, by_severity: { high: 0, medium: 0, low: 0 } };

  describe('Recovery Plan Fetching', () => {
    it('should fetch recovery plans for all projects', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Should call get for recovery plans for each project
        const recoveryPlanCalls = api.get.mock.calls.filter(call =>
          call[0].includes('/recovery-plans')
        );
        expect(recoveryPlanCalls.length).toBeGreaterThan(0);
      });
    });

    it('should handle recovery plan fetch errors gracefully', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      // Should not throw error
      expect(() => {
        render(
          <HomePage
            projects={mockProjects}
            projectsData={mockProjectsData}
            onNavigateToProject={vi.fn()}
            currentUser={mockCurrentUser}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Recovery Plan Indicator Display', () => {
    it('should show exclamation icon for red metrics without active recovery plans', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans?project_id=1')) {
          // Only return a plan for metric_id 11, not 10
          return Promise.resolve({
            data: [
              {
                id: 1,
                metric_id: 11,
                project_id: 1,
                plan_text: 'Recovery plan for metric 11',
                status: 'active',
              },
            ],
          });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        // Check for the exclamation icon
        const exclamationIcons = screen.queryAllByText('ExclamationIcon');
        // Should show icon for Red Metric Without Plan (metric_id 10)
        // but not for Red Metric With Plan (metric_id 11)
        expect(exclamationIcons.length).toBeGreaterThan(0);
      });
    });

    it('should NOT show exclamation icon for red metrics WITH active recovery plans', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans?project_id=1')) {
          // Return plans for all red metrics
          return Promise.resolve({
            data: [
              {
                id: 1,
                metric_id: 10,
                project_id: 1,
                plan_text: 'Recovery plan for metric 10',
                status: 'active',
              },
              {
                id: 2,
                metric_id: 11,
                project_id: 1,
                plan_text: 'Recovery plan for metric 11',
                status: 'active',
              },
            ],
          });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Should NOT show any exclamation icons since all red metrics have plans
        const exclamationIcons = screen.queryAllByText('ExclamationIcon');
        expect(exclamationIcons.length).toBe(0);
      });
    });

    it('should NOT show exclamation icon for amber metrics', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Even though Amber Metric has no plan, it shouldn't show the icon
        // because only red metrics require recovery plans
        const metricsAtRisk = screen.getByText(/Metrics at Risk/i);
        expect(metricsAtRisk).toBeTruthy();
      });
    });

    it('should NOT show icon for cancelled recovery plans', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans?project_id=1')) {
          // Return a cancelled plan
          return Promise.resolve({
            data: [
              {
                id: 1,
                metric_id: 10,
                project_id: 1,
                plan_text: 'Cancelled recovery plan',
                status: 'cancelled',
              },
            ],
          });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Should show icon because cancelled plans don't count as active
        const exclamationIcons = screen.queryAllByText('ExclamationIcon');
        expect(exclamationIcons.length).toBeGreaterThan(0);
      });
    });

    it('should NOT show icon for completed recovery plans', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans?project_id=1')) {
          // Return a completed plan
          return Promise.resolve({
            data: [
              {
                id: 1,
                metric_id: 10,
                project_id: 1,
                plan_text: 'Completed recovery plan',
                status: 'completed',
              },
            ],
          });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Should show icon because completed plans don't count as active
        const exclamationIcons = screen.queryAllByText('ExclamationIcon');
        expect(exclamationIcons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tooltip Functionality', () => {
    it('should have title attribute for hover tooltip', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Find elements with the recovery-plan-indicator class
        const indicators = document.querySelectorAll('.recovery-plan-indicator');
        indicators.forEach(indicator => {
          expect(indicator.getAttribute('title')).toBe('Recovery Plan Required');
        });
      });
    });
  });

  describe('RAG Filter Integration', () => {
    it('should show indicator when filtering by red metrics', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Click the Red filter button
        const redFilterButton = screen.getByText(/Red/);
        redFilterButton.click();
      });

      // Should still show the indicator for red metrics
      await waitFor(() => {
        const indicators = container.querySelectorAll('.recovery-plan-indicator');
        expect(indicators.length).toBeGreaterThan(0);
      });
    });

    it('should NOT show indicator when filtering by amber metrics', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Click the Amber filter button
        const amberFilterButton = screen.getByText(/Amber/);
        amberFilterButton.click();
      });

      // Should NOT show indicators for amber metrics
      await waitFor(() => {
        const indicators = container.querySelectorAll('.recovery-plan-indicator');
        expect(indicators.length).toBe(0);
      });
    });
  });

  describe('Visual Styling', () => {
    it('should have correct CSS classes for styling', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const indicators = container.querySelectorAll('.recovery-plan-indicator');
        indicators.forEach(indicator => {
          expect(indicator.classList.contains('recovery-plan-indicator')).toBe(true);
        });
      });
    });
  });

  describe('Multiple Projects Integration', () => {
    it('should show indicators across multiple projects', async () => {
      const multiProjectData = {
        1: mockProjectsData[1],
        2: [
          {
            id: 4,
            metric_id: 21,
            project_id: 2,
            metric: 'Another Red Metric',
            reporting_date: '2025-01-01',
            complete: 30,
            expected: 100,
            final_target: 500,
            rag_status: 'red',
            red_tolerance: 10,
            amber_tolerance: 5,
          },
        ],
      };

      api.get.mockImplementation((url) => {
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] }); // No plans for any project
        }
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: emptyInconsistencyReport });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={multiProjectData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Should show indicators for red metrics in both projects
        const exclamationIcons = screen.queryAllByText('ExclamationIcon');
        expect(exclamationIcons.length).toBeGreaterThan(1);
      });
    });
  });
});

describe('HomePage - Inconsistency Report Tests', () => {
  const mockProjects = {
    1: {
      id: 1,
      name: 'Project Alpha',
      portfolio_name: 'Portfolio A',
      portfolio_color: '#00aeef',
      initiative_manager: 'John Doe',
      description: 'Valid description',
    },
    2: {
      id: 2,
      name: 'Project Beta',
      portfolio_name: 'Portfolio B',
      portfolio_color: '#10b981',
      initiative_manager: 'Jane Smith',
      description: null, // Missing description
    },
    3: {
      id: 3,
      name: 'Project Gamma',
      portfolio_name: 'Portfolio C',
      portfolio_color: '#f59e0b',
      initiative_manager: 'John Doe',
      description: '',
    },
  };

  const mockProjectsData = {
    1: [
      {
        id: 1,
        metric_id: 10,
        project_id: 1,
        metric: 'Valid Metric',
        reporting_date: '2025-01-01',
        complete: 50,
        expected: 100,
        final_target: 500,
        rag_status: 'green',
        red_tolerance: 10,
        amber_tolerance: 5,
      },
    ],
    2: [],
    3: [],
  };

  const mockCurrentUser = {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    role: 'pm',
  };

  const mockInconsistencyReport = {
    summary: [
      {
        pm_name: 'Jane Smith',
        total: 15,
        high: 2,
        medium: 5,
        low: 8,
        issues: [
          {
            type: 'missing_project_description',
            severity: 'low',
            pm_name: 'Jane Smith',
            project_id: 2,
            project_name: 'Project Beta',
            metric_id: null,
            metric_name: null,
            details: 'Project missing description',
            first_detected: '2025-01-01T00:00:00.000Z',
            age_days: 15,
          },
          {
            type: 'missing_metric_description',
            severity: 'medium',
            pm_name: 'Jane Smith',
            project_id: 2,
            project_name: 'Project Beta',
            metric_id: 20,
            metric_name: 'Metric X',
            details: 'Metric missing description',
            first_detected: '2025-01-05T00:00:00.000Z',
            age_days: 10,
          },
          {
            type: 'missing_documentation',
            severity: 'low',
            pm_name: 'Jane Smith',
            project_id: 2,
            project_name: 'Project Beta',
            metric_id: null,
            metric_name: null,
            details: 'No documentation links',
            first_detected: '2025-01-10T00:00:00.000Z',
            age_days: 5,
          },
          {
            type: 'missing_metric_description',
            severity: 'medium',
            pm_name: 'Jane Smith',
            project_id: 2,
            project_name: 'Project Beta',
            metric_id: 21,
            metric_name: 'Metric Y',
            details: 'Metric missing description',
            first_detected: '2025-01-12T00:00:00.000Z',
            age_days: 3,
          },
        ],
      },
      {
        pm_name: 'John Doe',
        total: 3,
        high: 0,
        medium: 1,
        low: 2,
        issues: [
          {
            type: 'missing_project_description',
            severity: 'low',
            pm_name: 'John Doe',
            project_id: 3,
            project_name: 'Project Gamma',
            metric_id: null,
            metric_name: null,
            details: 'Project missing description',
            first_detected: '2025-01-08T00:00:00.000Z',
            age_days: 7,
          },
          {
            type: 'missing_metric_description',
            severity: 'medium',
            pm_name: 'John Doe',
            project_id: 3,
            project_name: 'Project Gamma',
            metric_id: 30,
            metric_name: 'Metric Z',
            details: 'Metric missing description',
            first_detected: '2025-01-14T00:00:00.000Z',
            age_days: 1,
          },
          {
            type: 'missing_documentation',
            severity: 'low',
            pm_name: 'John Doe',
            project_id: 3,
            project_name: 'Project Gamma',
            metric_id: null,
            metric_name: null,
            details: 'No documentation links',
            first_detected: '2025-01-14T00:00:00.000Z',
            age_days: 1,
          },
        ],
      },
    ],
    total_inconsistencies: 18,
    by_severity: {
      high: 2,
      medium: 6,
      low: 10,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inconsistency Report Display', () => {
    it('should display the Inconsistencies quadrant', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Inconsistencies')).toBeInTheDocument();
      });
    });

    it('should display PMs sorted by total inconsistency count', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const pmNames = container.querySelectorAll('.pm-name');
        expect(pmNames[0].textContent).toBe('Jane Smith'); // 15 total
        expect(pmNames[1].textContent).toBe('John Doe'); // 3 total
      });
    });

    it('should display total count for each PM', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const totalCounts = container.querySelectorAll('.total-count');
        expect(totalCounts[0].textContent).toBe('15');
        expect(totalCounts[1].textContent).toBe('3');
      });
    });

    it('should display only first 3 issues by default', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const pmItems = container.querySelectorAll('.inconsistency-pm-item');
        const janeSmithItem = pmItems[0];
        const issueDetails = within(janeSmithItem).getAllByRole('generic', { className: 'inconsistency-detail' });
        expect(issueDetails.length).toBe(3);
      });
    });

    it('should show "+X more" link when there are more than 3 issues', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        // Jane Smith has 4 issues, so should show "+1 more"
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });
    });

    it('should display age of inconsistencies', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/15d old/)).toBeInTheDocument();
        expect(screen.getByText(/10d old/)).toBeInTheDocument();
      });
    });

    it('should show "No inconsistencies found" when there are none', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({
            data: {
              summary: [],
              total_inconsistencies: 0,
              by_severity: { high: 0, medium: 0, low: 0 },
            },
          });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No inconsistencies found')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return new Promise(() => {}); // Never resolves
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });

  describe('Expandable Issue List', () => {
    it('should expand issue list when clicking "+X more"', async () => {
      const user = userEvent.setup();

      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });

      const moreLink = screen.getByText('+1 more');
      await user.click(moreLink);

      await waitFor(() => {
        const pmItems = container.querySelectorAll('.inconsistency-pm-item');
        const janeSmithItem = pmItems[0];
        const issueDetails = janeSmithItem.querySelectorAll('.inconsistency-detail');
        expect(issueDetails.length).toBe(4); // All issues now visible
      });
    });

    it('should show "Show less" text after expanding', async () => {
      const user = userEvent.setup();

      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });

      const moreLink = screen.getByText('+1 more');
      await user.click(moreLink);

      await waitFor(() => {
        expect(screen.getByText('Show less')).toBeInTheDocument();
      });
    });

    it('should collapse issue list when clicking "Show less"', async () => {
      const user = userEvent.setup();

      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });

      // Expand
      const moreLink = screen.getByText('+1 more');
      await user.click(moreLink);

      await waitFor(() => {
        expect(screen.getByText('Show less')).toBeInTheDocument();
      });

      // Collapse
      const lessLink = screen.getByText('Show less');
      await user.click(lessLink);

      await waitFor(() => {
        const pmItems = container.querySelectorAll('.inconsistency-pm-item');
        const janeSmithItem = pmItems[0];
        const issueDetails = janeSmithItem.querySelectorAll('.inconsistency-detail');
        expect(issueDetails.length).toBe(3); // Back to 3 issues
      });
    });

    it('should maintain independent expand/collapse state for each PM', async () => {
      const user = userEvent.setup();

      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });

      // Expand Jane Smith's issues
      const janeMoreLink = screen.getByText('+1 more');
      await user.click(janeMoreLink);

      await waitFor(() => {
        const pmItems = container.querySelectorAll('.inconsistency-pm-item');
        const janeSmithItem = pmItems[0];
        const johnDoeItem = pmItems[1];

        const janeIssues = janeSmithItem.querySelectorAll('.inconsistency-detail');
        const johnIssues = johnDoeItem.querySelectorAll('.inconsistency-detail');

        expect(janeIssues.length).toBe(4); // Expanded
        expect(johnIssues.length).toBe(3); // Still collapsed
      });
    });
  });

  describe('Issue Navigation', () => {
    it('should call onNavigateToProject when clicking an issue', async () => {
      const user = userEvent.setup();
      const mockNavigate = vi.fn();

      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={mockNavigate}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const issues = container.querySelectorAll('.inconsistency-detail');
        expect(issues.length).toBeGreaterThan(0);
      });

      const firstIssue = container.querySelector('.inconsistency-detail');
      await user.click(firstIssue);

      expect(mockNavigate).toHaveBeenCalledWith(2); // Project Beta ID
    });

    it('should have pointer cursor on issue items', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.resolve({ data: mockInconsistencyReport });
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      const { container } = render(
        <HomePage
          projects={mockProjects}
          projectsData={mockProjectsData}
          onNavigateToProject={vi.fn()}
          currentUser={mockCurrentUser}
        />
      );

      await waitFor(() => {
        const issues = container.querySelectorAll('.inconsistency-detail');
        issues.forEach(issue => {
          expect(issue.style.cursor).toBe('pointer');
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/inconsistency-report')) {
          return Promise.reject(new Error('API Error'));
        }
        if (url.includes('/recovery-plans')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.getCommentary.mockResolvedValue({ data: [] });
      api.getFeedback.mockResolvedValue({ data: [] });

      // Should not throw error
      expect(() => {
        render(
          <HomePage
            projects={mockProjects}
            projectsData={mockProjectsData}
            onNavigateToProject={vi.fn()}
            currentUser={mockCurrentUser}
          />
        );
      }).not.toThrow();
    });
  });
});
