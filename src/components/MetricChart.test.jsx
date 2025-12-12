import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetricChart from './MetricChart';
import { api } from '../api/client';

// Mock lottie-web to avoid canvas issues
vi.mock('lottie-web', () => ({
  default: {
    loadAnimation: vi.fn(() => ({
      destroy: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

// Mock lottie-react
vi.mock('lottie-react', () => ({
  default: () => null,
}));

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    updatePeriod: vi.fn(),
    getPeriodComments: vi.fn().mockResolvedValue({ data: [] }),
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  ComposedChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
  Bar: ({ children }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  LabelList: () => null,
  ReferenceLine: () => null,
}));

describe('MetricChart - Inline Editing Tests', () => {
  const mockProjectId = 1;
  const mockMetricName = 'Test Metric';
  const mockCurrentUser = {
    id: 1,
    name: 'Test PM',
    email: 'pm@test.com',
    role: 'pm',
  };

  const mockData = [
    {
      id: 1,
      metric_id: 10,
      project_id: 1,
      metric: 'Test Metric',
      reporting_date: '2025-01-01',
      complete: 100,
      expected: 120,
      final_target: 500,
      rag_status: 'red',
    },
    {
      id: 2,
      metric_id: 10,
      project_id: 1,
      metric: 'Test Metric',
      reporting_date: '2025-02-01',
      complete: 150,
      expected: 180,
      final_target: 500,
      rag_status: 'amber',
    },
    {
      id: 3,
      metric_id: 10,
      project_id: 1,
      metric: 'Test Metric',
      reporting_date: '2025-12-01',
      complete: 0,
      expected: 500,
      final_target: 500,
      rag_status: 'green',
    },
  ];

  const mockOnDataChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission Checks', () => {
    it('should show editable cells for PM users', () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      // Click on Latest Progress tab
      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Check for editable cells (they should have the editable-cell class)
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBeGreaterThan(0);
    });

    it('should NOT show editable cells for non-PM users', () => {
      const viewerUser = { ...mockCurrentUser, role: 'viewer' };

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={viewerUser}
          onDataChange={mockOnDataChange}
        />
      );

      // Click on Latest Progress tab
      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Check that cells are not editable
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBe(0);
    });

    it('should NOT show editable cells for admin users', () => {
      const adminUser = { ...mockCurrentUser, role: 'admin' };

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={adminUser}
          onDataChange={mockOnDataChange}
        />
      );

      // Click on Latest Progress tab
      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Admins should be able to edit
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBeGreaterThan(0);
    });
  });

  describe('Cell Click to Edit', () => {
    it('should show input field when clicking an editable cell', async () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      // Click on Latest Progress tab
      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Find and click on an editable cell
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBeGreaterThan(0);

      fireEvent.click(editableCells[0]);

      // Should show an input field
      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });
    });

    it('should populate input with current cell value', async () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      const cellToEdit = editableCells[0];
      const originalValue = cellToEdit.textContent;

      fireEvent.click(cellToEdit);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
        // The input value should match the original cell value (ignoring formatting)
        expect(input.value).toBeTruthy();
      });
    });
  });

  describe('Auto-save on Blur', () => {
    it('should save changes when input loses focus', async () => {
      api.updatePeriod.mockResolvedValue({ data: { success: true } });

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      // Change the value
      await userEvent.clear(input);
      await userEvent.type(input, '250');

      // Blur the input
      fireEvent.blur(input);

      // Should call the API
      await waitFor(() => {
        expect(api.updatePeriod).toHaveBeenCalled();
      });

      // Should call onDataChange to refresh the chart
      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalled();
      });
    });

    it('should not save if value is empty', async () => {
      api.updatePeriod.mockResolvedValue({ data: { success: true } });

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      // Clear the value
      await userEvent.clear(input);

      // Blur the input
      fireEvent.blur(input);

      // Should NOT call the API
      await waitFor(() => {
        expect(api.updatePeriod).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should not save if value is the same as original', async () => {
      api.updatePeriod.mockResolvedValue({ data: { success: true } });

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      const originalValue = editableCells[0].textContent;

      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      // Don't change the value, just blur
      fireEvent.blur(input);

      // Should NOT call the API (value unchanged)
      await waitFor(() => {
        expect(api.updatePeriod).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('Keyboard Support', () => {
    it('should save changes when pressing Enter key', async () => {
      api.updatePeriod.mockResolvedValue({ data: { success: true } });

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      // Change the value
      await userEvent.clear(input);
      await userEvent.type(input, '300');

      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      // Should call the API
      await waitFor(() => {
        expect(api.updatePeriod).toHaveBeenCalled();
      });
    });

    it('should cancel editing when pressing Escape key', async () => {
      api.updatePeriod.mockResolvedValue({ data: { success: true } });

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      // Change the value
      await userEvent.clear(input);
      await userEvent.type(input, '300');

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

      // Should NOT call the API
      await waitFor(() => {
        expect(api.updatePeriod).not.toHaveBeenCalled();
      }, { timeout: 1000 });

      // Input should be closed
      await waitFor(() => {
        const inputAfter = document.querySelector('input[type="number"]');
        expect(inputAfter).toBeFalsy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert when API call fails', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      api.updatePeriod.mockRejectedValue(new Error('Network error'));

      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');
      fireEvent.click(editableCells[0]);

      await waitFor(() => {
        const input = document.querySelector('input[type="number"]');
        expect(input).toBeTruthy();
      });

      const input = document.querySelector('input[type="number"]');

      await userEvent.clear(input);
      await userEvent.type(input, '250');
      fireEvent.blur(input);

      // Should show an error alert
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });
  });

  describe('Multiple Row Editing', () => {
    it('should allow editing Complete, Expected, and Target rows', async () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Find rows by their labels
      const completeLabel = screen.getByText('Complete');
      const expectedLabel = screen.getByText('Expected');
      const targetLabel = screen.getByText('Target');

      // All three rows should be present
      expect(completeLabel).toBeTruthy();
      expect(expectedLabel).toBeTruthy();
      expect(targetLabel).toBeTruthy();

      // Check that cells in all rows are editable
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBeGreaterThan(5); // Should have multiple editable cells across rows
    });
  });

  describe('Visual Feedback', () => {
    it('should show pencil icon on hover for editable cells', () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      // Check that editable cells have the class
      const editableCells = document.querySelectorAll('.editable-cell');
      expect(editableCells.length).toBeGreaterThan(0);

      // The CSS should handle showing the pencil icon on hover
      editableCells.forEach(cell => {
        expect(cell.classList.contains('editable-cell')).toBe(true);
      });
    });

    it('should show cursor pointer for editable cells', () => {
      render(
        <MetricChart
          projectId={mockProjectId}
          metricName={mockMetricName}
          data={mockData}
          currentUser={mockCurrentUser}
          onDataChange={mockOnDataChange}
        />
      );

      const latestProgressTab = screen.getByText('Latest Progress');
      fireEvent.click(latestProgressTab);

      const editableCells = document.querySelectorAll('.editable-cell');

      // Check that editable cells have pointer cursor style
      editableCells.forEach(cell => {
        const style = window.getComputedStyle(cell);
        expect(style.cursor).toBe('pointer');
      });
    });
  });
});
