import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectTimelinePanel from '../ProjectTimelinePanel';

// Mock the API client
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn()
  }
}));

// Mock ProjectTimelineBar component
vi.mock('../../ProjectTimelineBar', () => ({
  default: ({ projects, onProjectClick }) => (
    <div data-testid="project-timeline-bar">
      {projects.map(project => (
        <div
          key={project.id}
          data-testid={`project-${project.id}`}
          onClick={() => onProjectClick(project)}
        >
          {project.name}
        </div>
      ))}
    </div>
  )
}));

describe('ProjectTimelinePanel', () => {
  const mockProjects = [
    {
      id: 1,
      name: 'Project Alpha',
      start_date: '2024-01-01',
      target_date: '2024-06-30',
      portfolio_name: 'Portfolio A',
      pm_name: 'John Doe',
      status: 'green',
      milestones: [
        { id: 1, name: 'Design Phase', date: '2024-02-15', status: 'completed' },
        { id: 2, name: 'Development', date: '2024-04-30', status: 'in_progress' }
      ]
    },
    {
      id: 2,
      name: 'Project Beta',
      start_date: '2024-02-01',
      target_date: '2024-08-31',
      portfolio_name: 'Portfolio B',
      pm_name: 'Jane Smith',
      status: 'amber',
      milestones: [
        { id: 3, name: 'Planning', date: '2024-03-01', status: 'completed' }
      ]
    },
    {
      id: 3,
      name: 'Project Gamma',
      start_date: '2024-03-01',
      target_date: '2024-12-31',
      portfolio_name: 'Portfolio A',
      pm_name: 'Bob Wilson',
      status: 'red',
      milestones: []
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the panel with title', () => {
      render(<ProjectTimelinePanel />);
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      render(<ProjectTimelinePanel />);
      expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
    });

    it('should display expand button', () => {
      render(<ProjectTimelinePanel />);
      expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('should fetch projects on mount', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });

      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/projects');
      });
    });

    it('should display projects after loading', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });

      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByTestId('project-timeline-bar')).toBeInTheDocument();
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockRejectedValue(new Error('API Error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load timeline')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should display empty state when no projects', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: [] });

      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByText('No projects to display')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display filter buttons', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /portfolio a/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /portfolio b/i })).toBeInTheDocument();
      });
    });

    it('should filter projects by portfolio when filter is clicked', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const portfolioAButton = screen.getByRole('button', { name: /portfolio a/i });
        fireEvent.click(portfolioAButton);
      });

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('should show all projects when "All" filter is clicked', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        // First filter by portfolio
        const portfolioAButton = screen.getByRole('button', { name: /portfolio a/i });
        fireEvent.click(portfolioAButton);
      });

      // Then click All
      const allButton = screen.getByRole('button', { name: /all/i });
      fireEvent.click(allButton);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });

    it('should filter projects by status', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /green/i })).toBeInTheDocument();
      });

      const greenButton = screen.getByRole('button', { name: /green/i });
      fireEvent.click(greenButton);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
      expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument();
    });
  });

  describe('Project Selection', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display project details when a project is clicked', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const projectAlpha = screen.getByTestId('project-1');
        fireEvent.click(projectAlpha);
      });

      expect(screen.getByText(/PM: John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/Portfolio: Portfolio A/i)).toBeInTheDocument();
      expect(screen.getByText(/Start: 2024-01-01/i)).toBeInTheDocument();
      expect(screen.getByText(/Target: 2024-06-30/i)).toBeInTheDocument();
    });

    it('should display milestones when a project with milestones is selected', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const projectAlpha = screen.getByTestId('project-1');
        fireEvent.click(projectAlpha);
      });

      expect(screen.getByText('Milestones')).toBeInTheDocument();
      expect(screen.getByText('Design Phase')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });

    it('should display no milestones message for projects without milestones', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const projectGamma = screen.getByTestId('project-3');
        fireEvent.click(projectGamma);
      });

      expect(screen.getByText('No milestones defined')).toBeInTheDocument();
    });

    it('should close project details when close button is clicked', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const projectAlpha = screen.getByTestId('project-1');
        fireEvent.click(projectAlpha);
      });

      expect(screen.getByText(/PM: John Doe/i)).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText(/PM: John Doe/i)).not.toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should toggle between timeline and list view', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByTestId('project-timeline-bar')).toBeInTheDocument();
      });

      const listViewButton = screen.getByRole('button', { name: /list view/i });
      fireEvent.click(listViewButton);

      expect(screen.queryByTestId('project-timeline-bar')).not.toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should display projects in table format in list view', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const listViewButton = screen.getByRole('button', { name: /list view/i });
        fireEvent.click(listViewButton);
      });

      expect(screen.getByRole('columnheader', { name: /project name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /portfolio/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /pm/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });
  });

  describe('Expand/Full Screen Mode', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should expand to full screen when expand button is clicked', async () => {
      const { container } = render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        fireEvent.click(expandButton);
      });

      expect(container.querySelector('.fullscreen')).toBeInTheDocument();
    });

    it('should show collapse button when in full screen mode', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        fireEvent.click(expandButton);
      });

      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
    });

    it('should exit full screen when collapse button is clicked', async () => {
      const { container } = render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        fireEvent.click(expandButton);
      });

      expect(container.querySelector('.fullscreen')).toBeInTheDocument();

      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      fireEvent.click(collapseButton);

      expect(container.querySelector('.fullscreen')).not.toBeInTheDocument();
    });

    it('should exit full screen on Escape key press', async () => {
      const { container } = render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        fireEvent.click(expandButton);
      });

      expect(container.querySelector('.fullscreen')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(container.querySelector('.fullscreen')).not.toBeInTheDocument();
    });
  });

  describe('Auto-refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-refresh data every 30 seconds', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });

      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear auto-refresh interval on unmount', async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });

      const { unmount } = render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast-forward 30 seconds after unmount
      vi.advanceTimersByTime(30000);

      // Should still only have been called once
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should have proper ARIA labels', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /project timeline/i })).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const firstProject = screen.getByTestId('project-1');
        firstProject.focus();
        expect(document.activeElement).toBe(firstProject);

        fireEvent.keyDown(firstProject, { key: 'Enter', code: 'Enter' });
        expect(screen.getByText(/PM: John Doe/i)).toBeInTheDocument();
      });
    });

    it('should announce status changes to screen readers', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const greenButton = screen.getByRole('button', { name: /green/i });
        fireEvent.click(greenButton);
      });

      const statusMessage = screen.getByRole('status');
      expect(statusMessage).toHaveTextContent(/Showing.*green.*project/i);
    });
  });

  describe('Sorting', () => {
    beforeEach(async () => {
      const apiClient = require('../../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should sort projects by start date by default', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const projects = screen.getAllByTestId(/^project-/);
        expect(projects[0]).toHaveTextContent('Project Alpha');
        expect(projects[1]).toHaveTextContent('Project Beta');
        expect(projects[2]).toHaveTextContent('Project Gamma');
      });
    });

    it('should allow sorting by name in list view', async () => {
      render(<ProjectTimelinePanel />);

      await waitFor(() => {
        const listViewButton = screen.getByRole('button', { name: /list view/i });
        fireEvent.click(listViewButton);
      });

      const nameHeader = screen.getByRole('columnheader', { name: /project name/i });
      fireEvent.click(nameHeader);

      const rows = screen.getAllByRole('row').slice(1); // Skip header row
      expect(rows[0]).toHaveTextContent('Project Alpha');
      expect(rows[1]).toHaveTextContent('Project Beta');
      expect(rows[2]).toHaveTextContent('Project Gamma');
    });
  });
});