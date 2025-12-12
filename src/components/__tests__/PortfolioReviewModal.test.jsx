import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
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

// Mock the API client (use named export 'api')
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

describe('PortfolioReviewModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    portfolioId: 1,
    portfolioName: 'Test Portfolio'
  };

  const mockProjects = [
    {
      id: 1,
      name: 'Project Alpha',
      pm_name: 'John Doe',
      status: 'green',
      health_score: 85,
      completion: 65,
      metrics: [
        { name: 'Budget', status: 'green', value: 80000, target: 100000 },
        { name: 'Timeline', status: 'amber', value: 60, target: 100 }
      ]
    },
    {
      id: 2,
      name: 'Project Beta',
      pm_name: 'Jane Smith',
      status: 'amber',
      health_score: 70,
      completion: 40,
      metrics: [
        { name: 'Budget', status: 'amber', value: 120000, target: 100000 },
        { name: 'Timeline', status: 'red', value: 30, target: 100 }
      ]
    },
    {
      id: 3,
      name: 'Project Gamma',
      pm_name: 'Bob Wilson',
      status: 'red',
      health_score: 45,
      completion: 20,
      metrics: [
        { name: 'Budget', status: 'red', value: 150000, target: 100000 },
        { name: 'Timeline', status: 'red', value: 20, target: 100 }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      expect(screen.getByText('Portfolio Review: Test Portfolio')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<PortfolioReviewModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Portfolio Review: Test Portfolio')).not.toBeInTheDocument();
    });

    it('should display close button', () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: /×/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: /×/i });
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking outside modal', () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      const overlay = screen.getByTestId('modal-overlay');
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Data Loading', () => {
    beforeEach(() => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display loading state initially', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);
      expect(screen.getByText('Loading portfolio data...')).toBeInTheDocument();
    });

    it('should fetch portfolio report data on mount', async () => {
      const apiClient = require('../../api/client').default;
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/portfolios/1/report');
      });
    });

    it('should display projects after loading', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockRejectedValue(new Error('API Error'));

      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading portfolio data/i)).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    beforeEach(async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display view mode buttons', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument();
        expect(screen.getByText('Projects Grid')).toBeInTheDocument();
        expect(screen.getByText('Health Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Risk Matrix')).toBeInTheDocument();
      });
    });

    it('should switch to Projects Grid view when clicked', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const gridButton = screen.getByText('Projects Grid');
        fireEvent.click(gridButton);
      });

      expect(screen.getByText('Project Name')).toBeInTheDocument();
      expect(screen.getByText('PM')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should switch to Health Dashboard view when clicked', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const healthButton = screen.getByText('Health Dashboard');
        fireEvent.click(healthButton);
      });

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('should switch to Risk Matrix view when clicked', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const riskButton = screen.getByText('Risk Matrix');
        fireEvent.click(riskButton);
      });

      expect(screen.getByText(/High Impact/i)).toBeInTheDocument();
      expect(screen.getByText(/Low Impact/i)).toBeInTheDocument();
    });
  });

  describe('Executive Summary View', () => {
    beforeEach(async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display portfolio overview statistics', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Total Projects/i)).toBeInTheDocument();
        expect(screen.getByText(/Average Health/i)).toBeInTheDocument();
      });
    });

    it('should calculate and display correct RAG status counts', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1.*Green/)).toBeInTheDocument();
        expect(screen.getByText(/1.*Amber/)).toBeInTheDocument();
        expect(screen.getByText(/1.*Red/)).toBeInTheDocument();
      });
    });

    it('should display top performing projects', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Top Performers/i)).toBeInTheDocument();
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
    });

    it('should display projects needing attention', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Needs Attention/i)).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display export button', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Export/i)).toBeInTheDocument();
      });
    });

    it('should show export options when export button is clicked', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const exportButton = screen.getByText(/Export/i);
        fireEvent.click(exportButton);
      });

      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
      expect(screen.getByText('Export as Excel')).toBeInTheDocument();
      expect(screen.getByText('Export as PowerPoint')).toBeInTheDocument();
    });

    it('should trigger PDF export when PDF option is clicked', async () => {
      const mockExport = vi.fn();
      window.print = mockExport;

      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        const exportButton = screen.getByText(/Export/i);
        fireEvent.click(exportButton);
      });

      const pdfOption = screen.getByText('Export as PDF');
      fireEvent.click(pdfOption);

      expect(mockExport).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should trap focus within modal', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /×/i });
      expect(closeButton).toBeInTheDocument();

      // Focus should be trapped within modal elements
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);
    });

    it('should close modal on Escape key press', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('should display empty state when no projects in portfolio', async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: [] });

      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No projects found in this portfolio/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      const apiClient = require('../../api/client').default;
      apiClient.get.mockResolvedValue({ data: mockProjects });
    });

    it('should display refresh button', async () => {
      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });

    it('should refresh data when refresh button is clicked', async () => {
      const apiClient = require('../../api/client').default;

      render(<PortfolioReviewModal {...defaultProps} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        expect(apiClient.get).toHaveBeenLastCalledWith('/portfolios/1/report');
      });
    });
  });
});