import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Feedback from '../Feedback';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock API client - use named export
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

import { api } from '../../api/client';

describe('Feedback Component', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'pm'
  };

  const mockProjectId = 1;

  const mockFeedback = [
    {
      id: 1,
      project_id: 1,
      text: 'Need better documentation',
      status: 'open',
      created_at: '2024-01-15T10:00:00Z',
      created_by: 2,
      creator_name: 'John Doe',
      pm_response: null,
      responded_at: null
    },
    {
      id: 2,
      project_id: 1,
      text: 'Weekly updates would be helpful',
      status: 'open',
      created_at: '2024-01-14T09:00:00Z',
      created_by: 3,
      creator_name: 'Jane Smith',
      pm_response: 'Great suggestion, will implement',
      responded_at: '2024-01-14T15:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockFeedback });
    api.post.mockResolvedValue({ data: { id: 3 } });
    api.put.mockResolvedValue({ data: {} });
  });

  describe('Rendering', () => {
    it('should render the feedback component', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Check that the container is rendered
      const container = document.querySelector('.feedback-container');
      expect(container).toBeInTheDocument();
    });

    it('should show add feedback button for PM', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/Add Feedback/i)).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('Fetching Feedback', () => {
    it('should fetch feedback on mount when projectId is provided', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(`/feedback?project_id=${mockProjectId}`);
      });
    });

    it('should not fetch when no projectId', () => {
      render(<Feedback currentUser={mockUser} projectId={null} />);
      expect(api.get).not.toHaveBeenCalled();
    });

    it('should display fetched feedback items', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });
    });

    it('should handle fetch error gracefully', async () => {
      api.get.mockRejectedValueOnce(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        // Should not crash, should show empty state
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Submitting Feedback', () => {
    it('should open feedback form when add button is clicked', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/Add Feedback/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Add Feedback/i));

      // Form should appear - exact placeholder text
      expect(screen.getByPlaceholderText('Enter your feedback...')).toBeInTheDocument();
    });

    it('should submit feedback with correct data', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/Add Feedback/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Add Feedback/i));

      const textarea = screen.getByPlaceholderText('Enter your feedback...');
      fireEvent.change(textarea, { target: { value: 'Test feedback content' } });

      // Find and click submit button
      const submitButton = screen.getByText('Submit Feedback');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/feedback', {
          text: 'Test feedback content',
          project_id: mockProjectId
        });
      });
    });
  });

  describe('Filtering', () => {
    it('should filter feedback by status', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Click on "Open" filter
      const openFilter = screen.getByText(/Open/);
      fireEvent.click(openFilter);

      // Should filter to show only pending (open) items
      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });
    });
  });

  describe('PM Actions', () => {
    it('should show respond button for PM on feedback', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // PM should see respond button on pending feedback
      const respondButtons = screen.getAllByText(/Respond/i);
      expect(respondButtons.length).toBeGreaterThan(0);
    });

    it('should allow PM to respond to feedback', async () => {
      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Click respond button on the pending feedback item
      const respondButton = screen.getAllByText('Respond')[0];
      fireEvent.click(respondButton);

      // Response form should appear with specific placeholder
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your response...')).toBeInTheDocument();
      });
    });
  });

  describe('Viewer Role', () => {
    it('should show limited actions for viewer role', async () => {
      const viewerUser = { ...mockUser, role: 'viewer' };

      render(<Feedback currentUser={viewerUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Viewers can still add feedback but might not see respond buttons
      expect(screen.getByText(/Add Feedback/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no feedback exists', async () => {
      api.get.mockResolvedValueOnce({ data: [] });

      render(<Feedback currentUser={mockUser} projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show no feedback message or empty state
      const feedbackItems = document.querySelectorAll('.feedback-item');
      expect(feedbackItems.length).toBe(0);
    });
  });
});
