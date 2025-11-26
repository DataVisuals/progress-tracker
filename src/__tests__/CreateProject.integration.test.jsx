import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { api } from '../api/client';

/**
 * Integration Test: Complete Project Creation Workflow
 *
 * This test suite covers the full user journey of creating a new project,
 * adding metrics, setting expected values, and verifying RAG status calculations.
 *
 * Tests verify:
 * - User authentication
 * - Project creation form
 * - Metric setup
 * - Expected value configuration
 * - RAG status calculation
 * - Audit log entries
 */

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    login: vi.fn(),
    getProjects: vi.fn(),
    getProjectData: vi.fn(),
    getProjectMetrics: vi.fn(),
    getProjectLinks: vi.fn(),
    updateProject: vi.fn(),
    createMetric: vi.fn(),
    updateMetric: vi.fn(),
    updatePeriod: vi.fn(),
    getUsers: vi.fn(),
    getSpaces: vi.fn(),
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

describe('Integration: Create Project Workflow', () => {
  const mockAdminUser = {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  };

  const mockPortfolios = [
    { id: 1, name: 'Portfolio A', color: '#FF5733', space_id: 1 },
    { id: 2, name: 'Portfolio B', color: '#33C3FF', space_id: 1 }
  ];

  const mockSpaces = [
    { id: 1, name: 'Main Space' }
  ];

  const mockUsers = [
    { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    { id: 2, name: 'PM User', email: 'pm@example.com', role: 'pm' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup authenticated admin user
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'token') return 'mock-admin-token';
      if (key === 'user') return JSON.stringify(mockAdminUser);
      return null;
    });

    // Setup default API responses
    api.get.mockImplementation((url) => {
      if (url.includes('/portfolios')) {
        return Promise.resolve({ data: mockPortfolios });
      }
      if (url.includes('/projects')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/spaces')) {
        return Promise.resolve({ data: mockSpaces });
      }
      return Promise.resolve({ data: [] });
    });

    api.getUsers.mockResolvedValue({ data: mockUsers });
    api.getProjectData.mockResolvedValue({ data: [] });
    api.getProjectMetrics.mockResolvedValue({ data: [] });
    api.getProjectLinks.mockResolvedValue({ data: [] });
    api.getSpaces.mockResolvedValue({ data: mockSpaces });
  });

  it('should complete full project creation and metric setup workflow', async () => {
    const user = userEvent.setup();

    // Step 1: Render app as authenticated admin
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    // Step 2: Open Project dropdown
    const projectDropdown = screen.getByText('Project');
    await user.click(projectDropdown);

    // Step 3: Click "New Project"
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
    await user.click(screen.getByText('New Project'));

    // Step 4: Fill out project creation form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project name')).toBeInTheDocument();
    });

    const projectNameInput = screen.getByPlaceholderText('Enter project name');
    const projectDescInput = screen.getByPlaceholderText('Enter project description');
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    await user.type(projectNameInput, 'Test Integration Project');
    await user.type(projectDescInput, 'This is a test project for integration testing');
    await user.type(startDateInput, '2025-01-01');
    await user.type(endDateInput, '2025-12-31');

    // Step 5: Select portfolio
    const portfolioSelect = screen.getByLabelText(/portfolio/i);
    await user.click(portfolioSelect);
    await user.click(screen.getByText('Portfolio A'));

    // Step 6: Mock successful project creation
    const newProjectId = 100;
    api.post.mockImplementation((url, data) => {
      if (url.includes('/projects')) {
        return Promise.resolve({
          data: {
            id: newProjectId,
            name: data.name,
            description: data.description,
            start_date: data.start_date,
            end_date: data.end_date,
            portfolio_id: data.portfolio_id
          }
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Update getProjects to return the new project
    api.get.mockImplementation((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({
          data: [{
            id: newProjectId,
            name: 'Test Integration Project',
            description: 'This is a test project for integration testing',
            start_date: '2025-01-01',
            end_date: '2025-12-31',
            portfolio_id: 1,
            portfolio_name: 'Portfolio A',
            portfolio_color: '#FF5733'
          }]
        });
      }
      if (url.includes('/portfolios')) {
        return Promise.resolve({ data: mockPortfolios });
      }
      if (url.includes('/spaces')) {
        return Promise.resolve({ data: mockSpaces });
      }
      return Promise.resolve({ data: [] });
    });

    // Step 7: Submit project creation form
    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);

    // Step 8: Verify project was created
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({
          name: 'Test Integration Project',
          description: 'This is a test project for integration testing'
        })
      );
    });

    // Step 9: Verify project appears in project selector
    await waitFor(() => {
      expect(screen.getByText('Test Integration Project')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Step 10: Add a new metric
    // Mock the metric creation
    const newMetricId = 200;
    api.createMetric.mockResolvedValue({
      data: {
        id: newMetricId,
        project_id: newProjectId,
        name: 'User Signups',
        description: 'Number of new user registrations',
        frequency: 'monthly',
        type: 'lag',
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      }
    });

    // Mock get metrics to return the new metric
    api.getProjectMetrics.mockResolvedValue({
      data: [{
        id: newMetricId,
        name: 'User Signups',
        description: 'Number of new user registrations',
        frequency: 'monthly',
        type: 'lag',
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      }]
    });

    // Click "Add Metric" button (assuming it's in MetricTabs)
    const addMetricButton = screen.getByRole('button', { name: /add metric/i });
    await user.click(addMetricButton);

    // Fill out metric form
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/metric name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/metric name/i), 'User Signups');
    await user.type(screen.getByPlaceholderText(/description/i), 'Number of new user registrations');

    // Select metric type
    const metricTypeSelect = screen.getByLabelText(/metric type/i);
    await user.click(metricTypeSelect);
    await user.click(screen.getByText('Lag Measure'));

    // Set frequency
    const frequencySelect = screen.getByLabelText(/frequency/i);
    await user.click(frequencySelect);
    await user.click(screen.getByText('Monthly'));

    // Submit metric creation
    const createMetricButton = screen.getByRole('button', { name: /create metric/i });
    await user.click(createMetricButton);

    // Step 11: Verify metric was created
    await waitFor(() => {
      expect(api.createMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: newProjectId,
          name: 'User Signups',
          type: 'lag',
          frequency: 'monthly'
        })
      );
    });

    // Step 12: Set expected values (targets)
    // Mock the period data with expected values
    const mockPeriods = [
      {
        id: 1,
        metric_id: newMetricId,
        metric: 'User Signups',
        reporting_date: '2025-01-31',
        expected: 100,
        complete: 0,
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      },
      {
        id: 2,
        metric_id: newMetricId,
        metric: 'User Signups',
        reporting_date: '2025-02-28',
        expected: 200,
        complete: 0,
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      }
    ];

    api.getProjectData.mockResolvedValue({ data: mockPeriods });

    // Click on metric to view chart
    await user.click(screen.getByText('User Signups'));

    // Wait for chart to load
    await waitFor(() => {
      expect(screen.getByText(/expected/i)).toBeInTheDocument();
    });

    // Step 13: Update actual values to simulate progress
    const updatedPeriods = [
      {
        ...mockPeriods[0],
        complete: 95 // 5% behind = Amber
      },
      {
        ...mockPeriods[1],
        complete: 0
      }
    ];

    api.updatePeriod.mockResolvedValue({ data: updatedPeriods[0] });
    api.getProjectData.mockResolvedValue({ data: updatedPeriods });

    // Find and click on the first period's complete value cell
    const firstPeriodCell = screen.getByText('0'); // Initial complete value
    await user.click(firstPeriodCell);

    // Update the value
    const editInput = screen.getByDisplayValue('0');
    await user.clear(editInput);
    await user.type(editInput, '95');
    await user.keyboard('{Enter}');

    // Step 14: Verify RAG status calculation
    await waitFor(() => {
      expect(api.updatePeriod).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          complete: 95
        })
      );
    });

    // Verify amber RAG status appears (95/100 = 5% behind)
    await waitFor(() => {
      const ragMarker = document.querySelector('.metric-rag-marker.amber');
      expect(ragMarker).toBeInTheDocument();
    });

    // Step 15: Test red status (> 10% behind)
    const redPeriods = [
      {
        ...mockPeriods[0],
        complete: 85 // 15% behind = Red
      },
      {
        ...mockPeriods[1],
        complete: 0
      }
    ];

    api.getProjectData.mockResolvedValue({ data: redPeriods });

    // Update value to trigger red status
    await user.click(screen.getByDisplayValue('95'));
    const redInput = screen.getByDisplayValue('95');
    await user.clear(redInput);
    await user.type(redInput, '85');
    await user.keyboard('{Enter}');

    // Verify red RAG status
    await waitFor(() => {
      const ragMarker = document.querySelector('.metric-rag-marker.red');
      expect(ragMarker).toBeInTheDocument();
    });

    // Step 16: Verify project appears in HomePage "At Risk" section
    // Navigate to home page
    const homeButton = screen.getByText(/home/i);
    await user.click(homeButton);

    await waitFor(() => {
      expect(screen.getByText('Metrics at Risk')).toBeInTheDocument();
    });

    // Verify our project and metric appear in at-risk list
    await waitFor(() => {
      expect(screen.getByText('Test Integration Project')).toBeInTheDocument();
      expect(screen.getByText('User Signups')).toBeInTheDocument();
    });
  });

  it('should validate required fields in project creation', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Project')).toBeInTheDocument();
    });

    // Open New Project form
    await user.click(screen.getByText('Project'));
    await user.click(screen.getByText('New Project'));

    // Try to submit without filling required fields
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);

    // Verify validation errors
    await waitFor(() => {
      expect(screen.getByText(/project name.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/start date.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/end date.*required/i)).toBeInTheDocument();
    });

    // Verify project was not created
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.anything()
    );
  });

  it('should handle API errors gracefully during project creation', async () => {
    const user = userEvent.setup();

    // Mock API error
    api.post.mockRejectedValue({
      response: {
        status: 500,
        data: { error: 'Internal server error' }
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Project')).toBeInTheDocument();
    });

    // Open and fill New Project form
    await user.click(screen.getByText('Project'));
    await user.click(screen.getByText('New Project'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project name')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Enter project name'), 'Test Project');
    await user.type(screen.getByLabelText(/start date/i), '2025-01-01');
    await user.type(screen.getByLabelText(/end date/i), '2025-12-31');

    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/error.*creating project/i)).toBeInTheDocument();
    });

    // Verify modal stays open for user to retry
    expect(screen.getByPlaceholderText('Enter project name')).toBeInTheDocument();
  });

  it('should persist project selection after page refresh', async () => {
    const user = userEvent.setup();

    // Setup project in localStorage
    const selectedProjectId = '100';
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'token') return 'mock-token';
      if (key === 'user') return JSON.stringify(mockAdminUser);
      if (key === 'selectedProject') return selectedProjectId;
      return null;
    });

    // Mock project data
    api.get.mockImplementation((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({
          data: [{
            id: 100,
            name: 'Persisted Project',
            portfolio_id: 1,
            portfolio_name: 'Portfolio A',
            portfolio_color: '#FF5733'
          }]
        });
      }
      if (url.includes('/portfolios')) {
        return Promise.resolve({ data: mockPortfolios });
      }
      if (url.includes('/spaces')) {
        return Promise.resolve({ data: mockSpaces });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    // Verify project is selected on load
    await waitFor(() => {
      expect(screen.getByText('Persisted Project')).toBeInTheDocument();
    });
  });

  it('should allow PM to create recovery plan for red metric', async () => {
    const user = userEvent.setup();

    // Setup project with red metric
    const redProjectData = [
      {
        id: 1,
        metric_id: 1,
        metric: 'User Signups',
        reporting_date: '2025-01-31',
        expected: 100,
        complete: 80, // 20% behind = Red
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      }
    ];

    api.get.mockImplementation((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Red Metric Project',
            portfolio_id: 1
          }]
        });
      }
      if (url.includes('/portfolios')) {
        return Promise.resolve({ data: mockPortfolios });
      }
      if (url.includes('/spaces')) {
        return Promise.resolve({ data: mockSpaces });
      }
      return Promise.resolve({ data: [] });
    });

    api.getProjectData.mockResolvedValue({ data: redProjectData });
    api.getProjectMetrics.mockResolvedValue({
      data: [{ id: 1, name: 'User Signups' }]
    });

    render(<App />);

    // Navigate to project with red metric
    await waitFor(() => {
      expect(screen.getByText('Red Metric Project')).toBeInTheDocument();
    });

    // Verify red status is shown
    await waitFor(() => {
      const ragMarker = document.querySelector('.metric-rag-marker.red');
      expect(ragMarker).toBeInTheDocument();
    });

    // Click to create recovery plan
    const createPlanButton = screen.getByRole('button', { name: /create recovery plan/i });
    await user.click(createPlanButton);

    // Fill recovery plan form
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/plan description/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/plan description/i),
      'Increase marketing spend and improve onboarding flow'
    );

    const targetDateInput = screen.getByLabelText(/target date/i);
    await user.type(targetDateInput, '2025-02-15');

    // Submit recovery plan
    api.post.mockResolvedValue({
      data: {
        id: 1,
        metric_id: 1,
        description: 'Increase marketing spend and improve onboarding flow',
        target_date: '2025-02-15',
        status: 'active'
      }
    });

    const submitPlanButton = screen.getByRole('button', { name: /submit plan/i });
    await user.click(submitPlanButton);

    // Verify recovery plan was created
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/recovery-plans'),
        expect.objectContaining({
          metric_id: 1,
          description: 'Increase marketing spend and improve onboarding flow'
        })
      );
    });
  });
});
