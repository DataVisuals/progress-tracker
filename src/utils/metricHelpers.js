/**
 * Metric calculation utilities for the Progress Tracker application
 */

/**
 * Calculate RAG (Red/Amber/Green) status for a metric period
 * @param {Object} period - The metric period data
 * @param {Object} metricInfo - The metric configuration
 * @returns {Object} Object containing ragStatus, complete, and expected values
 */
export const calculateRAGForPeriod = (period, metricInfo) => {
  const complete = parseFloat(period.complete) || 0;
  const expected = parseFloat(period.expected) || 0;
  if (expected === 0) return { ragStatus: 'grey', complete, expected };

  const variance = complete - expected;
  const variancePercent = Math.abs((variance / expected) * 100);
  const redTolerance = metricInfo?.red_tolerance || 20;
  const amberTolerance = metricInfo?.amber_tolerance || 10;

  let ragStatus = 'green';
  if (variance < 0) {
    if (variancePercent > redTolerance) {
      ragStatus = 'red';
    } else if (variancePercent > amberTolerance) {
      ragStatus = 'amber';
    }
  }
  return { ragStatus, complete, expected };
};

/**
 * Check if a metric period has ended based on its reporting date and frequency
 * @param {string} reportingDate - The period's reporting date
 * @param {string} frequency - The metric frequency (weekly, fortnightly, monthly, quarterly)
 * @returns {boolean} True if the period has ended
 */
export const hasPeriodEnded = (reportingDate, frequency) => {
  const now = new Date();
  const startDate = new Date(reportingDate);
  startDate.setHours(0, 0, 0, 0);
  let periodEnd;
  switch (frequency) {
    case 'weekly':
      periodEnd = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'fortnightly':
      periodEnd = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      break;
    case 'quarterly':
      periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
      break;
    default:
      periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  }
  return now >= periodEnd;
};

/**
 * Check if a project needs a recovery plan based on its metrics
 * Uses the exact same RAG calculation logic as HomePage's at-risk metrics
 * @param {Array} projectData - The project's metric data
 * @param {Array} projectMetrics - The project's metric configurations
 * @param {Array} projectRecoveryPlans - The project's recovery plans
 * @returns {boolean} True if the project needs a recovery plan
 */
export const checkNeedsRecoveryPlan = (projectData, projectMetrics, projectRecoveryPlans) => {
  // Check if there are any red/amber metrics without active recovery plans
  const hasActivePlan = projectRecoveryPlans.some(plan => plan.status === 'active');

  // If there's already an active plan, no indicator needed
  if (hasActivePlan) return false;

  // Check each metric
  const metricsToCheck = new Set(projectData.map(d => d.metric));

  for (const metricName of metricsToCheck) {
    const metricInfo = projectMetrics.find(m => m.name === metricName);
    if (!metricInfo) continue;

    // Get all periods for this metric, sorted by reporting_date
    const metricData = projectData
      .filter(d => d.metric === metricName)
      .sort((a, b) => new Date(a.reporting_date) - new Date(b.reporting_date));

    if (metricData.length === 0) continue;

    // Find current period
    const now = new Date();
    let currentPeriodIndex = -1;

    for (let i = metricData.length - 1; i >= 0; i--) {
      const periodDate = new Date(metricData[i].reporting_date);
      if (periodDate <= now) {
        currentPeriodIndex = i;
        break;
      }
    }

    if (currentPeriodIndex < 0) continue;

    const currentPeriod = metricData[currentPeriodIndex];

    // Check if complete value has been entered
    // Note: complete defaults to 0 in database, so we treat 0 as "no value" for periods that haven't ended
    const hasCompleteValue = currentPeriod.complete !== null &&
                             currentPeriod.complete !== undefined &&
                             currentPeriod.complete !== '' &&
                             currentPeriod.complete !== 0;

    const frequency = currentPeriod.frequency || 'monthly';
    const periodHasEnded = hasPeriodEnded(currentPeriod.reporting_date, frequency);

    let ragResult;

    if (hasCompleteValue) {
      // Current period has a value, use it
      ragResult = calculateRAGForPeriod(currentPeriod, metricInfo);
    } else if (periodHasEnded) {
      // Period ended with no value = calculate based on 0 complete (will be red)
      ragResult = calculateRAGForPeriod(currentPeriod, metricInfo);
    } else if (currentPeriodIndex > 0) {
      // Period hasn't ended, no value - carry forward previous period's status
      const previousPeriod = metricData[currentPeriodIndex - 1];
      ragResult = calculateRAGForPeriod(previousPeriod, metricInfo);
    } else {
      // No previous period, no current value, period not ended = skip (grey)
      continue;
    }

    const { ragStatus } = ragResult;

    // If we find any red or amber metric, recovery plan is needed
    if (ragStatus === 'red' || ragStatus === 'amber') {
      return true;
    }
  }

  return false;
};
