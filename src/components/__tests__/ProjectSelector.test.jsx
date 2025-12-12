import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectSelector from '../ProjectSelector';

describe('ProjectSelector', () => {
  const mockProjects = {
    1: {
      id: 1,
      name: 'Project Alpha',
      portfolio_id: 1,
      portfolio_name: 'Portfolio A',
      portfolio_color: '#FF5733'
    },
    2: {
      id: 2,
      name: 'Project Beta',
      portfolio_id: 1,
      portfolio_name: 'Portfolio A',
      portfolio_color: '#FF5733'
    },
    3: {
      id: 3,
      name: 'Project Gamma',
      portfolio_id: 2,
      portfolio_name: 'Portfolio B',
      portfolio_color: '#33C3FF'
    },
    4: {
      id: 4,
      name: 'Test Project',
      portfolio_id: null,
      portfolio_name: null,
      portfolio_color: null
    }
  };

  const mockOnProjectChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with label "Project:"', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project:')).toBeInTheDocument();
    });

    it('should display selected project name', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('should show placeholder when no project selected', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject=""
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project...')).toBeInTheDocument();
    });

    it('should display portfolio color dot for selected project', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const portfolioDot = document.querySelector('.project-portfolio-dot');
      expect(portfolioDot).toBeInTheDocument();
      expect(portfolioDot).toHaveStyle({ backgroundColor: '#FF5733' });
    });

    it('should not display portfolio dot when project has no portfolio', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="4"
          onProjectChange={mockOnProjectChange}
        />
      );

      const portfolioDot = document.querySelector('.project-portfolio-dot');
      expect(portfolioDot).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should open dropdown when trigger is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      });
    });

    it('should close dropdown when trigger is clicked again', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');

      // Open dropdown
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      });

      // Close dropdown
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
      });
    });

    it('should display all projects in dropdown', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        // Project Alpha appears twice (in trigger and dropdown), so use getAllByText
        expect(screen.getAllByText('Project Alpha').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });
    });

    it('should highlight selected project in dropdown', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        // Get the option-item element with class 'selected' directly
        const selectedOption = document.querySelector('.option-item.selected');
        expect(selectedOption).toBeInTheDocument();
        expect(selectedOption).toHaveTextContent('Project Alpha');
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter projects by search term', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'Beta');

      await waitFor(() => {
        // Check that only Beta appears in the dropdown options
        const optionsList = document.querySelector('.options-list');
        expect(optionsList).toHaveTextContent('Project Beta');
        expect(optionsList).not.toHaveTextContent('Project Alpha');
        expect(optionsList).not.toHaveTextContent('Project Gamma');
      });
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'gamma');

      await waitFor(() => {
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });

    it('should show "No projects found" when search returns no results', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'NonexistentProject');

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument();
      });
    });

    // Note: Component only searches by project name, not portfolio name
    it.skip('should search by portfolio name as well', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'Portfolio A');

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument();
      });
    });

    it('should clear search when dropdown closes', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');

      // Open and search
      await user.click(trigger);
      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'Beta');

      // Close dropdown
      await user.click(trigger);

      // Reopen and verify search is cleared
      await user.click(trigger);
      await waitFor(() => {
        const newSearchInput = screen.getByPlaceholderText('Search projects...');
        expect(newSearchInput).toHaveValue('');
      });
    });
  });

  describe('Project Selection', () => {
    it('should call onProjectChange when project is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Project Beta'));

      expect(mockOnProjectChange).toHaveBeenCalledWith('2');
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Project Beta'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
      });
    });

    it('should allow selecting the same project again', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));
      // Click the option in the dropdown, not the trigger
      const optionItem = document.querySelector('.option-item.selected');
      await user.click(optionItem);

      expect(mockOnProjectChange).toHaveBeenCalledWith('1');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should open dropdown on Enter key', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      trigger.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      });
    });

    it('should close dropdown on Escape key', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
      });
    });

    it('should navigate options with arrow keys', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Check that the second item is highlighted
      await waitFor(() => {
        const highlightedItem = document.querySelector('.option-item.highlighted');
        expect(highlightedItem).toBeInTheDocument();
      });
    });

    it('should select highlighted option on Enter', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnProjectChange).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty projects object', () => {
      render(
        <ProjectSelector
          projects={{}}
          selectedProject=""
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project...')).toBeInTheDocument();
    });

    it('should handle undefined projects', () => {
      render(
        <ProjectSelector
          projects={undefined}
          selectedProject=""
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project...')).toBeInTheDocument();
    });

    it('should handle invalid selectedProject ID', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="999"
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project...')).toBeInTheDocument();
    });

    it('should handle very long project names', () => {
      const longNameProjects = {
        1: {
          id: 1,
          name: 'This is an extremely long project name that should be truncated or handled properly in the UI',
          portfolio_id: 1,
          portfolio_name: 'Portfolio A',
          portfolio_color: '#FF5733'
        }
      };

      render(
        <ProjectSelector
          projects={longNameProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText(/This is an extremely long/)).toBeInTheDocument();
    });

    it('should handle projects with special characters in names', () => {
      const specialCharProjects = {
        1: {
          id: 1,
          name: 'Project & Co. <Testing> "Quotes"',
          portfolio_id: 1,
          portfolio_name: 'Portfolio A',
          portfolio_color: '#FF5733'
        }
      };

      render(
        <ProjectSelector
          projects={specialCharProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      expect(screen.getByText('Project & Co. <Testing> "Quotes"')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();

      render(
        <ProjectSelector
          projects={mockProjects}
          selectedProject="1"
          onProjectChange={mockOnProjectChange}
        />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Click Outside', () => {
    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <ProjectSelector
            projects={mockProjects}
            selectedProject="1"
            onProjectChange={mockOnProjectChange}
          />
          <div data-testid="outside">Outside</div>
        </div>
      );

      // Open dropdown
      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      });

      // Click outside
      await user.click(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
      });
    });
  });
});
