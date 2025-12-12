import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpaceSelector from '../SpaceSelector';
import { vi } from 'vitest';

describe('SpaceSelector', () => {
  const mockOnSpaceChange = vi.fn();
  const mockOnManageSpaces = vi.fn();

  const mockSpaces = [
    { id: 1, name: 'Engineering', description: 'Engineering team space' },
    { id: 2, name: 'Marketing', description: 'Marketing team space' },
    { id: 3, name: 'Sales', description: 'Sales team space' }
  ];

  const defaultProps = {
    spaces: mockSpaces,
    selectedSpace: 'all',
    onSpaceChange: mockOnSpaceChange,
    onManageSpaces: mockOnManageSpaces
  };

  beforeEach(() => {
    mockOnSpaceChange.mockClear();
    mockOnManageSpaces.mockClear();
  });

  describe('Rendering', () => {
    it('should render the space selector component', () => {
      render(<SpaceSelector {...defaultProps} />);
      expect(screen.getByText('All Spaces')).toBeInTheDocument();
      expect(screen.getByText('Space:')).toBeInTheDocument();
    });

    it('should display selected space when provided', () => {
      render(<SpaceSelector {...defaultProps} selectedSpace={1} />);
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('should show placeholder when no selection', () => {
      render(<SpaceSelector {...defaultProps} selectedSpace={null} />);
      expect(screen.getByText('Select Space...')).toBeInTheDocument();
    });

    it('should handle empty spaces list', () => {
      render(<SpaceSelector {...defaultProps} spaces={[]} />);
      expect(screen.getByText('All Spaces')).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should open dropdown when clicked', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
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

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      // Click outside using mousedown (which the component listens to)
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown on escape key', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      fireEvent.keyDown(trigger, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Space Selection', () => {
    it('should call onSpaceChange when selecting a space', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Engineering'));

      expect(mockOnSpaceChange).toHaveBeenCalledWith(1);
    });

    it('should update display when space is selected', () => {
      const { rerender } = render(<SpaceSelector {...defaultProps} />);

      expect(screen.getByText('All Spaces')).toBeInTheDocument();

      // Simulate parent updating selection
      rerender(<SpaceSelector {...defaultProps} selectedSpace={1} />);

      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('should allow selecting "All Spaces" option', async () => {
      render(<SpaceSelector {...defaultProps} selectedSpace={1} />);

      const trigger = screen.getByRole('button', { name: /Engineering/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Find All Spaces option in dropdown
      const allSpacesOption = screen.getByRole('option', { name: /All Spaces/i });
      fireEvent.click(allSpacesOption);

      expect(mockOnSpaceChange).toHaveBeenCalledWith('all');
    });

    it('should close dropdown after selection', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Engineering'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Manage Spaces', () => {
    it('should show manage button when onManageSpaces is provided', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Manage')).toBeInTheDocument();
      });
    });

    it('should call onManageSpaces when manage button is clicked', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Manage')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Manage'));

      expect(mockOnManageSpaces).toHaveBeenCalled();
    });

    it('should not show manage button when onManageSpaces is not provided', async () => {
      render(<SpaceSelector {...defaultProps} onManageSpaces={undefined} />);

      const trigger = screen.getByRole('button', { name: /All Spaces/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(screen.queryByText('Manage')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when opened', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should be keyboard navigable - open with Enter', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');
      trigger.focus();

      fireEvent.keyDown(trigger, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable - open with Space', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');
      trigger.focus();

      fireEvent.keyDown(trigger, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable - open with ArrowDown', async () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');
      trigger.focus();

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should mark selected option with aria-selected', async () => {
      render(<SpaceSelector {...defaultProps} selectedSpace={1} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        const selectedOption = screen.getByRole('option', { name: 'Engineering' });
        expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks gracefully', () => {
      render(<SpaceSelector {...defaultProps} />);

      const trigger = screen.getByRole('button');

      // Rapid clicks
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      fireEvent.click(trigger);

      // Should not crash - component should still be usable
      expect(screen.getByText('Space:')).toBeInTheDocument();
    });

    it('should handle spaces with special characters', async () => {
      const specialSpaces = [
        { id: 1, name: 'Space & Team' },
        { id: 2, name: 'Space/Team' },
        { id: 3, name: 'Space "Team"' }
      ];

      render(<SpaceSelector {...defaultProps} spaces={specialSpaces} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Space & Team')).toBeInTheDocument();
        expect(screen.getByText('Space/Team')).toBeInTheDocument();
        expect(screen.getByText('Space "Team"')).toBeInTheDocument();
      });
    });

    it('should handle very long space names', async () => {
      const longNameSpaces = [
        { id: 1, name: 'This is a very long space name that should be handled properly' }
      ];

      render(<SpaceSelector {...defaultProps} spaces={longNameSpaces} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText(/This is a very long space name/)).toBeInTheDocument();
      });
    });

    it('should handle unnamed spaces gracefully', async () => {
      const unnamedSpaces = [
        { id: 1, name: '' },
        { id: 2, name: null }
      ];

      render(<SpaceSelector {...defaultProps} spaces={unnamedSpaces} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Space 1')).toBeInTheDocument();
        expect(screen.getByText('Space 2')).toBeInTheDocument();
      });
    });

    it('should handle selectedSpace as string number', () => {
      render(<SpaceSelector {...defaultProps} selectedSpace="1" />);
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });
  });
});
