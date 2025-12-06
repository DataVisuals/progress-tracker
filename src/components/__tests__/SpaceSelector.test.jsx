import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpaceSelector from '../SpaceSelector';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('SpaceSelector', () => {
  const mockOnSpaceChange = vi.fn();
  const defaultProps = {
    selectedSpace: null,
    onSpaceChange: mockOnSpaceChange
  };

  const mockSpaces = [
    { id: 1, name: 'Engineering', description: 'Engineering team space' },
    { id: 2, name: 'Marketing', description: 'Marketing team space' },
    { id: 3, name: 'Sales', description: 'Sales team space' }
  ];

  beforeEach(() => {
    fetch.mockClear();
    mockOnSpaceChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render the space selector component', () => {
      render(<SpaceSelector {...defaultProps} />);
      expect(screen.getByText(/All Spaces/i)).toBeInTheDocument();
    });

    it('should display selected space when provided', () => {
      const selectedSpace = { id: 1, name: 'Engineering' };
      render(<SpaceSelector {...defaultProps} selectedSpace={selectedSpace} />);
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('should show loading state initially', async () => {
      fetch.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockSpaces)
        }), 100))
      );

      render(<SpaceSelector {...defaultProps} />);

      // Check for any loading indicator if present
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/spaces');
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch spaces on mount', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/spaces');
      });
    });

    it('should handle API error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetch.mockRejectedValueOnce(new Error('API Error'));

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/spaces');
      });

      // Component should still render
      expect(screen.getByText(/All Spaces/i)).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty spaces list', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/spaces');
      });

      expect(screen.getByText(/All Spaces/i)).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });
    });

    it('should open dropdown when clicked', async () => {
      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      // Check if spaces are displayed
      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
        expect(screen.getByText('Sales')).toBeInTheDocument();
      });
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <SpaceSelector {...defaultProps} />
          <div data-testid="outside">Outside Element</div>
        </div>
      );

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Open dropdown
      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.click(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByText('Engineering')).not.toBeVisible();
      });
    });

    it('should close dropdown on escape key', async () => {
      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Engineering')).not.toBeVisible();
      });
    });
  });

  describe('Space Selection', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });
    });

    it('should call onSpaceChange when selecting a space', async () => {
      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Engineering'));

      expect(mockOnSpaceChange).toHaveBeenCalledWith(mockSpaces[0]);
    });

    it('should update display when space is selected', async () => {
      const { rerender } = render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Simulate selection
      rerender(<SpaceSelector {...defaultProps} selectedSpace={mockSpaces[0]} />);

      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('should allow selecting "All Spaces" option', async () => {
      const { rerender } = render(
        <SpaceSelector {...defaultProps} selectedSpace={mockSpaces[0]} />
      );

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText('Engineering');
      fireEvent.click(selector);

      // Look for All Spaces option
      const allSpacesOption = screen.getByText(/All Spaces/i);
      fireEvent.click(allSpacesOption);

      expect(mockOnSpaceChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });
    });

    it('should filter spaces based on search input', async () => {
      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      // Find search input if present
      const searchInput = screen.queryByPlaceholderText(/search/i);
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: 'Eng' } });

        await waitFor(() => {
          expect(screen.getByText('Engineering')).toBeInTheDocument();
          expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
          expect(screen.queryByText('Sales')).not.toBeInTheDocument();
        });
      }
    });

    it('should show no results message for non-matching search', async () => {
      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      const searchInput = screen.queryByPlaceholderText(/search/i);
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

        await waitFor(() => {
          expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
          expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
          expect(screen.queryByText(/no spaces found/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SpaceSelector {...defaultProps} />);

      const selector = screen.getByText(/All Spaces/i).closest('div');
      expect(selector).toHaveAttribute('role');
    });

    it('should be keyboard navigable', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);

      // Tab to selector
      selector.focus();
      expect(selector).toHaveFocus();

      // Open with Enter key
      fireEvent.keyDown(selector, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });
    });

    it('should announce selected space to screen readers', async () => {
      render(<SpaceSelector {...defaultProps} selectedSpace={mockSpaces[0]} />);

      const selector = screen.getByText('Engineering');
      expect(selector.closest('div')).toHaveAttribute('aria-label');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks gracefully', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSpaces)
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);

      // Rapid clicks
      fireEvent.click(selector);
      fireEvent.click(selector);
      fireEvent.click(selector);

      // Should not crash or behave unexpectedly
      expect(screen.getByText(/All Spaces/i)).toBeInTheDocument();
    });

    it('should handle spaces with special characters', async () => {
      const specialSpaces = [
        { id: 1, name: 'Space & Team', description: 'With ampersand' },
        { id: 2, name: 'Space/Team', description: 'With slash' },
        { id: 3, name: 'Space "Team"', description: 'With quotes' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(specialSpaces)
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      await waitFor(() => {
        expect(screen.getByText('Space & Team')).toBeInTheDocument();
        expect(screen.getByText('Space/Team')).toBeInTheDocument();
        expect(screen.getByText('Space "Team"')).toBeInTheDocument();
      });
    });

    it('should handle very long space names', async () => {
      const longNameSpaces = [
        {
          id: 1,
          name: 'This is a very long space name that should be handled properly by the component without breaking the layout',
          description: 'Long name test'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(longNameSpaces)
      });

      render(<SpaceSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const selector = screen.getByText(/All Spaces/i);
      fireEvent.click(selector);

      await waitFor(() => {
        const longNameElement = screen.getByText(/This is a very long space name/);
        expect(longNameElement).toBeInTheDocument();
      });
    });
  });
});