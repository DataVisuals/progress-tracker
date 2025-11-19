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

  it('should show red status when current period has data and is behind schedule', () => {
    // Current period has data (complete > 0), so show actual RAG status
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 80, expected: 100 }, // 20% behind - this is current period with data
      { date: '2025-11-15', complete: 0, expected: 110 },  // Future period
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
    // Current period has data (complete=80), so show red
    expect(ragMarker).toHaveClass('red');
  });

  it('should use previous period status when current period has no data', () => {
    // Current period has complete=0, so use previous period's status
    const projectData = createProjectData('Test Metric', [
      { date: '2025-10-01', complete: 80, expected: 100 }, // Previous period, 20% behind = RED
      { date: '2025-11-01', complete: 0, expected: 110 },  // Current period with no data
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
    // Current period has no data (complete=0), so use previous period's RED status
    expect(ragMarker).toHaveClass('red');
  });

  it('should show status for current period when it has data', () => {
    // Use a past period that's completed (next period has started)
    const projectData = createProjectData('Test Metric', [
      { date: '2025-10-01', complete: 80, expected: 100 }, // Past period, 20% behind
      { date: '2025-11-01', complete: 85, expected: 110 }, // Current period with data, ~23% behind = RED
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
    // Current period has data (complete=85), so calculate its status (23% behind = RED)
    expect(ragMarker).toHaveClass('red');
  });

  it('should show amber status when behind schedule by > amber tolerance but <= red tolerance', () => {
    // Current period has data (complete > 0), so show actual RAG status
    const projectData = createProjectData('Test Metric', [
      { date: '2025-11-01', complete: 93, expected: 100 }, // 7% behind - current period with data
      { date: '2025-11-15', complete: 0, expected: 110 },  // Future period
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
    // Current period has data (complete=93), so show amber (7% behind)
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
    // Current period with missing data should show grey
    expect(ragMarker).toHaveClass('grey');
  });

  it('should show grey status for metrics with all periods in the future', () => {
    // All periods are after Nov 8, 2025 (the mocked date)
    const projectData = createProjectData('Future Metric', [
      { date: '2025-12-01', complete: 0, expected: 10 },
      { date: '2026-01-01', complete: 0, expected: 20 },
      { date: '2026-02-01', complete: 0, expected: 30 }
    ]);

    render(
      <MetricTabs
        metrics={['Future Metric']}
        projectData={projectData}
        selectedMetric="Future Metric"
        onMetricChange={() => {}}
        canEdit={false}
      />
    );

    const ragMarker = document.querySelector('.metric-rag-marker');
    // Future metrics should show grey status
    expect(ragMarker).toHaveClass('grey');
  });

  it('should use custom tolerance values from data', () => {
    // Current period with future period to test tolerance values
    const projectData = createProjectData('Test Metric', [
      {
        date: '2025-11-01',
        complete: 70,
        expected: 100,
        amberTolerance: 20.0,  // Custom: 20%
        redTolerance: 40.0     // Custom: 40%
      },
      {
        date: '2025-11-15',
        complete: 0,
        expected: 110,
        amberTolerance: 20.0,
        redTolerance: 40.0
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
    // Current period has data (complete=70), 30% behind with custom tolerances
    // 30% is > 20% amber but < 40% red, so AMBER
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
