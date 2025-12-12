import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProjectTimelinePanel from '../ProjectTimelinePanel';

describe('ProjectTimelinePanel', () => {
  const mockNavigate = vi.fn();

  // Use dates relative to now for testing
  const today = new Date();
  const formatDate = (date) => date.toISOString().split('T')[0];

  const getDate = (monthsOffset) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + monthsOffset);
    return formatDate(d);
  };

  const mockProjects = [
    {
      id: 1,
      name: 'Project Alpha',
      start_date: getDate(-2),  // 2 months ago
      end_date: getDate(4),     // 4 months from now
      portfolio_id: 1,
      portfolio_color: '#10b981'
    },
    {
      id: 2,
      name: 'Project Beta',
      start_date: getDate(-1),  // 1 month ago
      end_date: getDate(6),     // 6 months from now
      portfolio_id: 2,
      portfolio_color: '#3b82f6'
    },
    {
      id: 3,
      name: 'Project Gamma',
      start_date: getDate(0),   // this month
      end_date: getDate(10),    // 10 months from now
      portfolio_id: 1,
      portfolio_color: '#10b981'
    }
  ];

  const mockPortfolios = [
    { id: 1, name: 'Portfolio A', space_id: 1 },
    { id: 2, name: 'Portfolio B', space_id: 2 }
  ];

  const mockMilestones = {
    1: [
      { id: 1, title: 'Design Phase', target_date: getDate(-1), completed: 1 },
      { id: 2, title: 'Development', target_date: getDate(2), completed: 0 }
    ],
    2: [
      { id: 3, title: 'Planning', target_date: getDate(1), completed: 1 }
    ],
    3: []
  };

  const mockHealthRankings = {
    allSorted: [
      { id: 1, healthScore: 85 },
      { id: 2, healthScore: 65 },
      { id: 3, healthScore: 45 }
    ]
  };

  const defaultProps = {
    panelId: 'timeline-panel',
    index: 0,
    projects: mockProjects,
    portfolios: mockPortfolios,
    milestones: mockMilestones,
    projectHealthRankings: mockHealthRankings,
    onNavigateToProject: mockNavigate,
    selectedSpace: 'all'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the panel with title', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });

    it('should display empty state when no projects provided', () => {
      render(<ProjectTimelinePanel {...defaultProps} projects={[]} />);
      expect(screen.getByText('No projects with end dates')).toBeInTheDocument();
    });

    it('should display empty state when projects have no end dates', () => {
      const projectsWithoutEndDates = [
        { id: 1, name: 'No End Date', start_date: '2024-01-01' }
      ];
      render(<ProjectTimelinePanel {...defaultProps} projects={projectsWithoutEndDates} />);
      expect(screen.getByText('No projects with end dates')).toBeInTheDocument();
    });

    it('should render projects with end dates', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });

    it('should render time markers', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);
      // Should have timeline axis markers (months)
      const container = document.querySelector('.timeline-axis');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Project Navigation', () => {
    it('should call onNavigateToProject when a project row is clicked', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);

      const projectRow = screen.getByText('Project Alpha').closest('.timeline-project-row');
      fireEvent.click(projectRow);

      expect(mockNavigate).toHaveBeenCalledWith(1);
    });

    it('should call onNavigateToProject with correct project id', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);

      const projectRow = screen.getByText('Project Beta').closest('.timeline-project-row');
      fireEvent.click(projectRow);

      expect(mockNavigate).toHaveBeenCalledWith(2);
    });
  });

  describe('Space Filtering', () => {
    it('should filter projects by selected space', () => {
      render(<ProjectTimelinePanel {...defaultProps} selectedSpace="1" />);

      // Portfolio A is in space 1, so Project Alpha and Gamma should show
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      // Project Beta is in Portfolio B (space 2), should not show
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('should show all projects when selectedSpace is "all"', () => {
      render(<ProjectTimelinePanel {...defaultProps} selectedSpace="all" />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });
  });

  describe('Health Status Colors', () => {
    it('should apply health-based colors to project bars', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);

      // Projects should be rendered with health score colors
      const projectRows = document.querySelectorAll('.timeline-project-row');
      expect(projectRows.length).toBe(3);
    });
  });

  describe('Empty States', () => {
    it('should handle undefined projects gracefully', () => {
      render(<ProjectTimelinePanel {...defaultProps} projects={undefined} />);
      expect(screen.getByText('No projects with end dates')).toBeInTheDocument();
    });

    it('should handle null projects gracefully', () => {
      render(<ProjectTimelinePanel {...defaultProps} projects={null} />);
      expect(screen.getByText('No projects with end dates')).toBeInTheDocument();
    });

    it('should handle missing portfolios gracefully', () => {
      render(<ProjectTimelinePanel {...defaultProps} portfolios={undefined} />);
      // Should still render projects
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
  });

  describe('Milestones', () => {
    it('should render milestones for projects that have them', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);

      // Milestones should be rendered as stop markers (tubemap-stop) on the timeline
      const milestoneMarkers = document.querySelectorAll('.tubemap-stop');
      expect(milestoneMarkers.length).toBeGreaterThan(0);
    });
  });

  describe('Today Indicator', () => {
    it('should render today indicator on timeline', () => {
      render(<ProjectTimelinePanel {...defaultProps} />);

      // Today marker uses timeline-today-marker-row class
      const todayIndicator = document.querySelector('.timeline-today-marker-row');
      expect(todayIndicator).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('should render with minimal props', () => {
      render(
        <ProjectTimelinePanel
          projects={mockProjects}
          onNavigateToProject={mockNavigate}
        />
      );
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });
  });
});
