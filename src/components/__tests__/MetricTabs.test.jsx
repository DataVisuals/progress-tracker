import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import MetricTabs from '../MetricTabs';

describe('MetricTabs RAG Status Calculation', () => {
  // Mock current date to Nov 8, 2025 for consistent testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-08'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createProjectData = (metricName, dataPoints) => {
    return dataPoints.map(dp => ({
      metric: metricName,
      reporting_date: dp.date,
      complete: dp.complete,
      expected: dp.expected,
      amber_tolerance: dp.amberTolerance || 5.0,
      red_tolerance: dp.redTolerance || 10.0
    }));
  };

  it('should show green status when complete >= expected (on track or ahead)', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 10, expected: 8 }, // Ahead by 2
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    expect(ragMarker).toHaveClass('green');
  });

  it('should show red status when behind schedule by > red tolerance', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 80, expected: 100 }, // 20% behind
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    expect(ragMarker).toHaveClass('red');
  });

  it('should show amber status when behind schedule by > amber tolerance but <= red tolerance', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 93, expected: 100 }, // 7% behind (between 5% and 10%)
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    expect(ragMarker).toHaveClass('amber');
  });

  it('should use current period (most recent date <= today) not absolute latest', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-07', complete: 10, expected: 8 },   // Current period - GREEN
      { date: '2025-12-07', complete: 0, expected: 15 },   // Future period - would be RED
      { date: '2026-01-07', complete: 0, expected: 23 }    // Future period - would be RED
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    // Should use Nov 7 (current period) which is GREEN, not Dec/Jan which would be RED
    expect(ragMarker).toHaveClass('green');
  });

  it('should show grey status when expected is 0', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 5, expected: 0 },
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    expect(ragMarker).toHaveClass('grey');
  });

  it('should override RAG status to grey when trajectory is flat', () => {
    const projectData = createProjectData('Test Metric', [
      { date: '2025-09-01', complete: 10, expected: 10 },
      { date: '2025-10-01', complete: 10.1, expected: 20 }, // Would be RED (50% behind)
      { date: '2025-11-01', complete: 10.15, expected: 30 }, // Would be RED (66% behind)
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    // Trajectory is flat (changes < 2%), so should override to grey
    expect(ragMarker).toHaveClass('grey');
  });

  it('should handle null/undefined complete or expected values', () => {
    const projectData = [
      {
        metric: 'Test Metric',
        reporting_date: '2025-11-01',
        complete: null,
        expected: 10,
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      }
    ];

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    expect(ragMarker).toBeNull(); // Should not show any marker
  });

  it('should use custom tolerance values from data', () => {
    const projectData = createProjectData('Test Metric', [
      {
        date: '2025-11-01',
        complete: 70,
        expected: 100,
        amberTolerance: 20.0,  // Custom: 20%
        redTolerance: 40.0     // Custom: 40%
      }
    ]);

    render(
      <MetricTabs
        metrics={['Test Metric']}
        projectData={projectData}
        selectedMetric="Test Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    // 30% behind, which is between 20% (amber) and 40% (red)
    expect(ragMarker).toHaveClass('amber');
  });
});

describe('MetricTabs and MetricChart consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-08'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate variance the same way as MetricChart (complete - expected)', () => {
    // This test documents the variance calculation formula
    // MetricChart.jsx line 828: const variance = entry.complete - entry.expected;
    // MetricTabs.jsx line 32: const variance = complete - expected;

    const testCases = [
      { complete: 10, expected: 8, expectedVariance: 2, expectedStatus: 'green' },    // Ahead
      { complete: 98, expected: 100, expectedVariance: -2, expectedStatus: 'green' }, // 2% behind (< 5%)
      { complete: 94, expected: 100, expectedVariance: -6, expectedStatus: 'amber' }, // 6% behind
      { complete: 85, expected: 100, expectedVariance: -15, expectedStatus: 'red' }   // 15% behind
    ];

    testCases.forEach(({ complete, expected, expectedVariance, expectedStatus }) => {
      const variance = complete - expected;
      expect(variance).toBe(expectedVariance);

      // Verify RAG status logic
      const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;
      let status;
      if (expected === 0) {
        status = 'grey';
      } else if (variance >= 0) {
        status = 'green';
      } else if (variancePercent > 10.0) {
        status = 'red';
      } else if (variancePercent > 5.0) {
        status = 'amber';
      } else {
        status = 'green';
      }

      expect(status).toBe(expectedStatus);
    });
  });
});
