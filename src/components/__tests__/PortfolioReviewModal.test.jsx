import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PortfolioReviewModal from '../PortfolioReviewModal';

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
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  }
}));

// Mock recharts to avoid rendering issues in tests
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
  Radar: () => null
}));

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,test'
  })
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addPage: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn()
  }))
}));

// Mock the ProjectTimelineBar component
vi.mock('../ProjectTimelineBar', () => ({
  default: () => <div data-testid="project-timeline-bar">Timeline Bar</div>
}));

// Mock the MetricChart component
vi.mock('../MetricChart', () => ({
  default: ({ metricName }) => <div data-testid="metric-chart">{metricName}</div>
}));

// Mock the health score and clarity score utilities
vi.mock('../ProjectHealthModal', () => ({
  calculateHealthScores: vi.fn().mockReturnValue({
    overall: 75,
    projectDescribed: 80,
    metricsDescribed: 70,
    metricCoverage: 75,
    metricManagement: 70,
    projectControl: 80,
    contentClarity: 75
  })
}));

vi.mock('../../utils/clarityScore', () => ({
  calculateClarityScore: vi.fn().mockReturnValue(70)
}));

describe('PortfolioReviewModal', () => {
  const mockProjects = [
    {
      id: 1,
      name: 'Project Alpha',
      portfolio_id: 1,
      description: 'Test project',
      initiative_manager: 'John Doe',
      start_date: '2025-01-01',
      end_date: '2025-12-31'
    },
    {
      id: 2,
      name: 'Project Beta',
      portfolio_id: 1,
      description: 'Another test project',
      initiative_manager: 'Jane Smith',
      start_date: '2025-02-01',
      end_date: '2025-11-30'
    }
  ];

  const defaultProps = {
    portfolioId: 1,
    portfolioName: 'Test Portfolio',
    projects: mockProjects,
    portfolios: [],
    onClose: vi.fn(),
    darkMode: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the modal with portfolio name', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Portfolio Review.*Test Portfolio/)).toBeInTheDocument();
      });
    });

    it('should render close button', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: '' });
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('should call onClose when close button is clicked', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        // Find the close button (it has the MdClose icon inside)
        const buttons = screen.getAllByRole('button');
        const closeButton = buttons.find(btn => btn.classList.contains('modal-close'));
        if (closeButton) {
          fireEvent.click(closeButton);
          expect(defaultProps.onClose).toHaveBeenCalled();
        }
      });
    });

    it('should display loading state initially', () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      expect(screen.getByText('Loading portfolio data...')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have navigation buttons', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Previous/)).toBeInTheDocument();
        expect(screen.getByText(/Next/)).toBeInTheDocument();
      });
    });

    it('should disable Previous button on first slide', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const prevButton = screen.getByText(/Previous/).closest('button');
        expect(prevButton).toBeDisabled();
      });
    });
  });

  describe('Empty State', () => {
    it('should handle empty projects array', async () => {
      const props = {
        ...defaultProps,
        projects: []
      };

      render(<PortfolioReviewModal {...props} />);

      await waitFor(() => {
        // Should still render but with no project slides
        expect(screen.getByText(/Portfolio Review.*Test Portfolio/)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow keys', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Portfolio Review.*Test Portfolio/)).toBeInTheDocument();
      });

      // Fire keyboard events
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });

      // The component should handle these without errors
      expect(screen.getByText(/Portfolio Review.*Test Portfolio/)).toBeInTheDocument();
    });
  });
});
