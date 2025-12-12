import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import JumpToProject from '../JumpToProject';

// Mock scrollIntoView which is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn()
  }
}));

import { api } from '../../api/client';

describe('JumpToProject', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectProject = vi.fn();

  const mockProjects = [
    { id: 1, name: 'Alpha Project', portfolio_id: 1 },
    { id: 2, name: 'Beta Testing', portfolio_id: 2 },
    { id: 3, name: 'Gamma Release', portfolio_id: 1 },
    { id: 4, name: 'Delta Operations', portfolio_id: 3 },
    { id: 5, name: 'Website Redesign', portfolio_id: 1 }
  ];

  const mockPortfolios = [
    { id: 1, name: 'Engineering', color: '#10b981' },
    { id: 2, name: 'QA', color: '#3b82f6' },
    { id: 3, name: 'Operations', color: '#f59e0b' }
  ];

  const mockSpaces = [
    { id: 1, name: 'Main Space' }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSelectProject: mockOnSelectProject,
    portfolios: mockPortfolios,
    spaces: mockSpaces
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockProjects });
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<JumpToProject {...defaultProps} isOpen={false} />);
      expect(screen.queryByPlaceholderText('Jump to project...')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Jump to project...')).toBeInTheDocument();
      });
    });

    it('should display search input', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Jump to project...')).toBeInTheDocument();
      });
    });

    it('should display keyboard hints', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/navigate/i)).toBeInTheDocument();
        expect(screen.getByText(/select/i)).toBeInTheDocument();
        expect(screen.getByText(/close/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch projects when opened', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/projects');
      });
    });

    it('should show loading state while fetching', async () => {
      // Make API call hang
      api.get.mockImplementation(() => new Promise(() => {}));

      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Loading projects...')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.get.mockRejectedValue(new Error('API Error'));

      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        // Should show empty state, not crash
        expect(screen.getByText(/type to search/i)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Search Functionality', () => {
    it('should show all projects when no search term', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
        expect(screen.getByText('Beta Testing')).toBeInTheDocument();
        expect(screen.getByText('Gamma Release')).toBeInTheDocument();
      });
    });

    it('should filter projects based on search term', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.change(input, { target: { value: 'Alpha' } });

      await waitFor(() => {
        // When searching, text is highlighted with <mark> tags, so use textContent check
        const resultItems = document.querySelectorAll('.jump-result-item');
        expect(resultItems.length).toBe(1);
        expect(resultItems[0].textContent).toContain('Alpha');
        expect(screen.queryByText('Beta Testing')).not.toBeInTheDocument();
      });
    });

    it('should support fuzzy matching', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      // "alp" should match "Alpha Project" via fuzzy matching
      fireEvent.change(input, { target: { value: 'alp' } });

      await waitFor(() => {
        // When searching, text is highlighted with <mark> tags, so use textContent check
        const resultItems = document.querySelectorAll('.jump-result-item');
        expect(resultItems.length).toBeGreaterThan(0);
        expect(resultItems[0].textContent).toContain('Alpha');
      });
    });

    it('should show no results message when no matches', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.change(input, { target: { value: 'xyz123' } });

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument();
      });
    });

    it('should highlight matching characters', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.change(input, { target: { value: 'alp' } });

      await waitFor(() => {
        // The matching characters should be wrapped in <mark> tags
        const marks = document.querySelectorAll('mark');
        expect(marks.length).toBeGreaterThan(0);
      });
    });

    it('should be case-insensitive', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.change(input, { target: { value: 'ALPHA' } });

      await waitFor(() => {
        // When searching, text is highlighted with <mark> tags, so use textContent check
        const resultItems = document.querySelectorAll('.jump-result-item');
        expect(resultItems.length).toBe(1);
        expect(resultItems[0].textContent).toContain('Alpha');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down with ArrowDown key', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');

      // First item should be selected initially
      let items = document.querySelectorAll('.jump-result-item');
      expect(items[0]).toHaveClass('selected');

      // Press down arrow
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      items = document.querySelectorAll('.jump-result-item');
      expect(items[1]).toHaveClass('selected');
    });

    it('should navigate up with ArrowUp key', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');

      // Move down first
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      let items = document.querySelectorAll('.jump-result-item');
      expect(items[2]).toHaveClass('selected');

      // Press up arrow
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      items = document.querySelectorAll('.jump-result-item');
      expect(items[1]).toHaveClass('selected');
    });

    it('should select project with Enter key', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSelectProject).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close on Escape key', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Jump to project...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not go below list bounds', async () => {
      // Only 5 projects
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');

      // Press down many times
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      }

      const items = document.querySelectorAll('.jump-result-item');
      const selectedIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
      expect(selectedIndex).toBeLessThan(items.length);
    });

    it('should not go above list bounds', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Jump to project...');

      // Try to go up from first item
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      const items = document.querySelectorAll('.jump-result-item');
      expect(items[0]).toHaveClass('selected');
    });
  });

  describe('Mouse Interaction', () => {
    it('should select project on click', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Alpha Project'));

      expect(mockOnSelectProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Alpha Project' })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should highlight item on hover', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta Testing')).toBeInTheDocument();
      });

      const betaItem = screen.getByText('Beta Testing').closest('.jump-result-item');
      fireEvent.mouseEnter(betaItem);

      expect(betaItem).toHaveClass('selected');
    });

    it('should close when clicking overlay', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(document.querySelector('.jump-overlay')).toBeInTheDocument();
      });

      fireEvent.click(document.querySelector('.jump-overlay'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking modal content', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(document.querySelector('.jump-modal')).toBeInTheDocument();
      });

      fireEvent.click(document.querySelector('.jump-modal'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Portfolio Display', () => {
    it('should show portfolio name for projects', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      // Multiple projects may have the same portfolio, so use getAllByText
      const portfolioBadges = screen.getAllByText('Engineering');
      expect(portfolioBadges.length).toBeGreaterThan(0);
    });

    it('should apply portfolio color', async () => {
      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      });

      // Get all portfolio badges and check the first one
      const portfolioBadges = screen.getAllByText('Engineering');
      expect(portfolioBadges[0]).toHaveStyle({ backgroundColor: '#10b981' });
    });
  });

  describe('Search Reset', () => {
    it('should reset search when closed and reopened', async () => {
      const { rerender } = render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Jump to project...')).toBeInTheDocument();
      });

      // Type something
      const input = screen.getByPlaceholderText('Jump to project...');
      fireEvent.change(input, { target: { value: 'Alpha' } });

      // Close
      rerender(<JumpToProject {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<JumpToProject {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        const newInput = screen.getByPlaceholderText('Jump to project...');
        expect(newInput.value).toBe('');
      });
    });
  });

  describe('Results Limiting', () => {
    it('should limit results to 10', async () => {
      // Create 15 projects
      const manyProjects = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        name: `Project ${i + 1}`,
        portfolio_id: 1
      }));

      api.get.mockResolvedValue({ data: manyProjects });

      render(<JumpToProject {...defaultProps} />);

      await waitFor(() => {
        const items = document.querySelectorAll('.jump-result-item');
        expect(items.length).toBeLessThanOrEqual(10);
      });
    });
  });
});
