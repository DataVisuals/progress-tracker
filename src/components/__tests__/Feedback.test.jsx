import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Feedback from '../Feedback';
import { vi } from 'vitest';

// Mock API client
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

import apiClient from '../../api/client';

describe('Feedback Component', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'pm'
  };

  const mockProjects = [
    { id: 1, name: 'Project Alpha', pm_id: 1 },
    { id: 2, name: 'Project Beta', pm_id: 2 },
    { id: 3, name: 'Project Gamma', pm_id: 1 }
  ];

  const mockFeedback = [
    {
      id: 1,
      project_id: 1,
      project_name: 'Project Alpha',
      category: 'process',
      content: 'Need better documentation',
      status: 'pending',
      created_at: '2024-01-15T10:00:00Z',
      created_by: 2,
      creator_name: 'John Doe',
      pm_response: null,
      responded_at: null
    },
    {
      id: 2,
      project_id: 2,
      project_name: 'Project Beta',
      category: 'communication',
      content: 'Weekly updates would be helpful',
      status: 'responded',
      created_at: '2024-01-14T09:00:00Z',
      created_by: 3,
      creator_name: 'Jane Smith',
      pm_response: 'Great suggestion, will implement',
      responded_at: '2024-01-14T15:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the feedback component', () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });

    it('should show submit feedback button', () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);
      expect(screen.getByText(/Submit Feedback/i)).toBeInTheDocument();
    });

    it('should display feedback categories', async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/feedback');
      });
    });
  });

  describe('Fetching Feedback', () => {
    it('should fetch feedback on mount', async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/feedback');
      });
    });

    it('should display fetched feedback items', async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });
    });

    it('should handle fetch error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValueOnce(new Error('API Error'));

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      // Component should still render
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Submitting Feedback', () => {
    beforeEach(async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] }); // For my-projects endpoint
    });

    it('should open feedback modal when submit button is clicked', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      const submitButton = await screen.findByText(/Submit Feedback/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Submit New Feedback/i)).toBeInTheDocument();
      });
    });

    it('should submit feedback with correct data', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          id: 3,
          ...mockFeedback[0],
          content: 'New feedback content'
        }
      });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      const submitButton = await screen.findByText(/Submit Feedback/i);
      fireEvent.click(submitButton);

      // Fill form
      const projectSelect = await screen.findByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: '1' } });

      const categorySelect = screen.getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: 'process' } });

      const contentTextarea = screen.getByLabelText(/Feedback/i);
      fireEvent.change(contentTextarea, { target: { value: 'New feedback content' } });

      const submitFormButton = screen.getByRole('button', { name: /Submit/i });
      fireEvent.click(submitFormButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/feedback', {
          projectId: 1,
          category: 'process',
          content: 'New feedback content'
        });
      });
    });

    it('should validate required fields', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      const submitButton = await screen.findByText(/Submit Feedback/i);
      fireEvent.click(submitButton);

      const submitFormButton = await screen.findByRole('button', { name: /Submit/i });
      fireEvent.click(submitFormButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/Please select a project/i)).toBeInTheDocument();
      });
    });

    it('should close modal after successful submission', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { ...mockFeedback[0] } });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      const submitButton = await screen.findByText(/Submit Feedback/i);
      fireEvent.click(submitButton);

      // Fill and submit form
      const projectSelect = await screen.findByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: '1' } });

      const categorySelect = screen.getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: 'process' } });

      const contentTextarea = screen.getByLabelText(/Feedback/i);
      fireEvent.change(contentTextarea, { target: { value: 'Test feedback' } });

      const submitFormButton = screen.getByRole('button', { name: /Submit/i });
      fireEvent.click(submitFormButton);

      await waitFor(() => {
        expect(screen.queryByText(/Submit New Feedback/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('PM Response Functionality', () => {
    const pmUser = {
      ...mockUser,
      role: 'pm'
    };

    beforeEach(async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: mockProjects.filter(p => p.pm_id === 1) });
    });

    it('should show respond button for PM on their projects', async () => {
      render(<Feedback user={pmUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Should see respond button for Project Alpha (PM's project)
      const respondButtons = screen.getAllByText(/Respond/i);
      expect(respondButtons.length).toBeGreaterThan(0);
    });

    it('should allow PM to respond to feedback', async () => {
      apiClient.put.mockResolvedValueOnce({
        data: {
          ...mockFeedback[0],
          pm_response: 'Thank you for the feedback',
          status: 'responded'
        }
      });

      render(<Feedback user={pmUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      const respondButton = screen.getAllByText(/Respond/i)[0];
      fireEvent.click(respondButton);

      const responseTextarea = await screen.findByPlaceholderText(/Enter your response/i);
      fireEvent.change(responseTextarea, { target: { value: 'Thank you for the feedback' } });

      const submitResponseButton = screen.getByRole('button', { name: /Send Response/i });
      fireEvent.click(submitResponseButton);

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          '/api/feedback/1/respond',
          { response: 'Thank you for the feedback' }
        );
      });
    });

    it('should show resolve button for responded feedback', async () => {
      render(<Feedback user={pmUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });

      // Should see resolve button for responded feedback
      const resolveButtons = screen.getAllByText(/Resolve/i);
      expect(resolveButtons.length).toBeGreaterThan(0);
    });

    it('should allow PM to resolve feedback', async () => {
      apiClient.put.mockResolvedValueOnce({
        data: {
          ...mockFeedback[1],
          status: 'resolved'
        }
      });

      render(<Feedback user={pmUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });

      const resolveButton = screen.getAllByText(/Resolve/i)[0];
      fireEvent.click(resolveButton);

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith('/api/feedback/2/resolve');
      });
    });
  });

  describe('Filtering and Sorting', () => {
    beforeEach(async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });
    });

    it('should filter feedback by status', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Find and use status filter
      const statusFilter = screen.getByLabelText(/Status/i);
      fireEvent.change(statusFilter, { target: { value: 'pending' } });

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
        expect(screen.queryByText('Weekly updates would be helpful')).not.toBeInTheDocument();
      });
    });

    it('should filter feedback by category', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      const categoryFilter = screen.getByLabelText(/Category/i);
      fireEvent.change(categoryFilter, { target: { value: 'communication' } });

      await waitFor(() => {
        expect(screen.queryByText('Need better documentation')).not.toBeInTheDocument();
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });
    });

    it('should filter feedback by project', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      const projectFilter = screen.getByLabelText(/Project/i);
      fireEvent.change(projectFilter, { target: { value: '2' } });

      await waitFor(() => {
        expect(screen.queryByText('Need better documentation')).not.toBeInTheDocument();
        expect(screen.getByText('Weekly updates would be helpful')).toBeInTheDocument();
      });
    });
  });

  describe('Status Indicators', () => {
    beforeEach(async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });
    });

    it('should show pending status indicator', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
      });

      const pendingBadge = screen.getByText('pending');
      expect(pendingBadge).toHaveClass('status-pending');
    });

    it('should show responded status indicator', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('responded')).toBeInTheDocument();
      });

      const respondedBadge = screen.getByText('responded');
      expect(respondedBadge).toHaveClass('status-responded');
    });

    it('should show resolved status indicator', async () => {
      const resolvedFeedback = [
        {
          ...mockFeedback[0],
          status: 'resolved'
        }
      ];

      apiClient.get.mockReset();
      apiClient.get.mockResolvedValueOnce({ data: resolvedFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('resolved')).toBeInTheDocument();
      });

      const resolvedBadge = screen.getByText('resolved');
      expect(resolvedBadge).toHaveClass('status-resolved');
    });
  });

  describe('Permissions', () => {
    it('should not show PM actions for viewer role', async () => {
      const viewerUser = { ...mockUser, role: 'viewer' };
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });

      render(<Feedback user={viewerUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Should not see respond buttons
      expect(screen.queryByText(/Respond/i)).not.toBeInTheDocument();
    });

    it('should allow admin to respond to any feedback', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: mockProjects });

      render(<Feedback user={adminUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Admin should see respond buttons for all feedback
      const respondButtons = screen.getAllByText(/Respond/i);
      expect(respondButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Edit Functionality', () => {
    beforeEach(async () => {
      apiClient.get.mockResolvedValueOnce({ data: mockFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });
    });

    it('should allow user to edit their own feedback', async () => {
      const userFeedback = [
        {
          ...mockFeedback[0],
          created_by: 1 // Same as mockUser.id
        }
      ];

      apiClient.get.mockReset();
      apiClient.get.mockResolvedValueOnce({ data: userFeedback });
      apiClient.get.mockResolvedValueOnce({ data: [] });

      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      const editButton = screen.getByText(/Edit/i);
      expect(editButton).toBeInTheDocument();
    });

    it('should not show edit button for other users feedback', async () => {
      render(<Feedback user={mockUser} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Need better documentation')).toBeInTheDocument();
      });

      // Feedback is created by user 2, logged in as user 1
      expect(screen.queryByText(/Edit/i)).not.toBeInTheDocument();
    });
  });
});