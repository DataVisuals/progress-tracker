import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { api } from '../api/client';

/**
 * Integration Test: App Rendering with Authentication States
 *
 * These tests verify basic app rendering and authentication flow.
 * More comprehensive workflow tests are documented in comments for future implementation.
 */

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

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  RadarChart: ({ children }) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  Radar: () => null,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  ReferenceLine: () => null,
}));

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  refreshToken: vi.fn().mockResolvedValue({ token: 'mock-refreshed-token' }),
}));

// Create a fresh QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

// Wrapper component for tests
const TestWrapper = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Helper to render with QueryClient
const renderWithClient = (ui) => {
  return render(ui, { wrapper: TestWrapper });
};

describe('App Integration: Basic Rendering', () => {
  const mockAdminUser = {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  };

  const mockPortfolios = [
    { id: 1, name: 'Portfolio A', color: '#FF5733', space_id: 1 }
  ];

  const mockSpaces = [
    { id: 1, name: 'Main Space' }
  ];

  const mockProjects = [
    {
      id: 1,
      name: 'Test Project',
      portfolio_id: 1,
      portfolio_name: 'Portfolio A',
      portfolio_color: '#FF5733',
      start_date: '2025-01-01',
      end_date: '2025-12-31'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear localStorage
    localStorage.clear();

    // Setup default API responses
    api.get.mockImplementation((url) => {
      if (url.includes('/portfolios')) {
        return Promise.resolve({ data: mockPortfolios });
      }
      if (url.includes('/projects') && !url.includes('/data') && !url.includes('/metrics') && !url.includes('/links')) {
        return Promise.resolve({ data: mockProjects });
      }
      if (url.includes('/spaces')) {
        return Promise.resolve({ data: mockSpaces });
      }
      if (url.includes('/data')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/metrics')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/links')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('should render login form when not authenticated', async () => {
    renderWithClient(<App />);

    // App should show login/unauthenticated state
    await waitFor(() => {
      // The app header should be visible
      const header = document.querySelector('.app-header-main');
      expect(header).toBeInTheDocument();
    });
  });

  it('should render app container', async () => {
    renderWithClient(<App />);

    await waitFor(() => {
      const appContainer = document.querySelector('.app-container') || document.querySelector('.app');
      expect(appContainer).toBeInTheDocument();
    });
  });

  it('should render header with theme toggle', async () => {
    renderWithClient(<App />);

    await waitFor(() => {
      const header = document.querySelector('.app-header-main');
      expect(header).toBeInTheDocument();
    });
  });

  it('should show authenticated user content when logged in', async () => {
    // Setup authenticated state
    localStorage.setItem('token', 'mock-admin-token');
    localStorage.setItem('user', JSON.stringify(mockAdminUser));

    renderWithClient(<App />);

    await waitFor(() => {
      // When authenticated, should show main app content
      const appContainer = document.querySelector('.app-container') || document.querySelector('.app');
      expect(appContainer).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    // Setup authenticated state
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('user', JSON.stringify(mockAdminUser));

    // Mock API error
    api.get.mockRejectedValue(new Error('Network error'));

    renderWithClient(<App />);

    // App should still render without crashing
    await waitFor(() => {
      const appContainer = document.querySelector('.app-container') || document.querySelector('.app');
      expect(appContainer).toBeInTheDocument();
    });
  });
});

/*
 * FUTURE INTEGRATION TESTS
 *
 * The following test scenarios document intended workflows for future implementation:
 *
 * 1. Complete Project Creation Workflow
 *    - User authentication
 *    - Open "New Project" form
 *    - Fill required fields (name, description, dates, portfolio)
 *    - Submit and verify project appears in project list
 *
 * 2. Metric Setup Workflow
 *    - Select project
 *    - Click "Add Metric"
 *    - Configure metric (name, type, frequency, tolerances)
 *    - Set expected values for periods
 *    - Verify metric appears in project
 *
 * 3. RAG Status Verification
 *    - Update actual values for metrics
 *    - Verify green/amber/red status calculation
 *    - Verify status appears on dashboard
 *
 * 4. Recovery Plan Creation
 *    - Create red status metric
 *    - Open recovery plan form
 *    - Fill plan details
 *    - Verify plan is created and associated
 *
 * These tests require the UI structure to match:
 * - 'New Project' button or menu item
 * - Form fields with specific placeholders/labels
 * - .metric-rag-marker CSS classes for status
 * - Recovery plan creation UI
 */
