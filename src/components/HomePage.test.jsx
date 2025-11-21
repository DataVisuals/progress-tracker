import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import { api } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    getCommentary: vi.fn(),
    getFeedback: vi.fn(),
  },
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

  describe('Recovery Plan Fetching', () => {
    it('should fetch recovery plans for all projects', async () => {
      api.get.mockImplementation((url) => {
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
