import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricChart from '../MetricChart';

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
vi.mock('../../api/client', () => ({
  api: {
    updatePeriod: vi.fn(),
    getPeriodComments: vi.fn().mockResolvedValue({ data: [] }),
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock ResizeObserver for Recharts
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock the Feedback component to avoid dependency issues
vi.mock('../Feedback', () => ({
  default: () => <div data-testid="feedback-component">Feedback Component</div>
}));

describe('Feedback Tab Visibility', () => {
  const mockProps = {
    metricName: 'Test Metric',
    data: [],
    canEdit: false,
    canEditData: false,
    onDataChange: vi.fn(),
    projectId: 1,
    onTimeTravelChange: vi.fn(),
    onRevert: vi.fn(),
    isAdmin: false,
    onToleranceChange: vi.fn()
  };

  it('should show Feedback tab when user is logged in', () => {
    const currentUser = { id: 1, name: 'Test User', role: 'viewer' };

    render(
      <MetricChart
        {...mockProps}
        currentUser={currentUser}
      />
    );

    // Look for the Feedback tab button
    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();
  });

  it('should hide Feedback tab when user is not logged in', () => {
    render(
      <MetricChart
        {...mockProps}
        currentUser={null}
      />
    );

    // The Feedback tab button should not be rendered
    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).not.toBeInTheDocument();
  });

  it('should hide Feedback tab when currentUser is undefined', () => {
    render(
      <MetricChart
        {...mockProps}
        currentUser={undefined}
      />
    );

    // The Feedback tab button should not be rendered
    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).not.toBeInTheDocument();
  });

  it('should show Feedback tab for viewer role', () => {
    const currentUser = { id: 1, name: 'Viewer User', role: 'viewer' };

    render(
      <MetricChart
        {...mockProps}
        currentUser={currentUser}
      />
    );

    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();
  });

  it('should show Feedback tab for PM role', () => {
    const currentUser = { id: 2, name: 'PM User', role: 'pm' };

    render(
      <MetricChart
        {...mockProps}
        currentUser={currentUser}
      />
    );

    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();
  });

  it('should show Feedback tab for admin role', () => {
    const currentUser = { id: 3, name: 'Admin User', role: 'admin' };

    render(
      <MetricChart
        {...mockProps}
        currentUser={currentUser}
      />
    );

    const feedbackButton = screen.queryByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();
  });
});
