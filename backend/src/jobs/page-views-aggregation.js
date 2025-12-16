/**
 * Page Views Data Aggregation Job
 *
 * This job runs daily to:
 * 1. Aggregate page_views data older than 30 days into summary tables
 * 2. Delete the aggregated detailed records
 * 3. Keep recent (last 30 days) detailed data for real-time analytics
 *
 * Percentiles (p50, p90) provide smoothed metrics that are less affected
 * by outliers from deployments/restarts.
 */

const logger = console;

/**
 * Calculate percentile from a sorted array
 * @param {number[]} sortedArr - Sorted array of values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number|null}
 */
function calculatePercentile(sortedArr, percentile) {
  if (!sortedArr || sortedArr.length === 0) return null;
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, index)];
}

/**
 * Aggregate page views data older than the retention period
 * @param {object} db - Database instance with all() and run() methods
 * @param {number} retentionDays - Number of days to keep detailed data (default: 30)
 */
async function aggregateOldPageViews(db, retentionDays = 30) {
  const startTime = Date.now();
  logger.info(`🔄 Starting page_views aggregation job (retention: ${retentionDays} days)`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Step 1: Aggregate daily summaries with percentiles
    logger.info(`  📊 Aggregating daily summaries before ${cutoffDateStr}...`);

    // Get all dates that need aggregation
    const dailyDates = await db.all(`
      SELECT DISTINCT DATE(created_at) as date
      FROM page_views
      WHERE DATE(created_at) < ?
      ORDER BY date
    `, [cutoffDateStr]);

    let dailyAggCount = 0;
    for (const { date } of dailyDates) {
      // Get all load times for this date
      const loadTimes = await db.all(`
        SELECT load_time_ms
        FROM page_views
        WHERE DATE(created_at) = ? AND load_time_ms IS NOT NULL
        ORDER BY load_time_ms
      `, [date]);

      const sortedTimes = loadTimes.map(r => r.load_time_ms);
      const p50 = calculatePercentile(sortedTimes, 50);
      const p90 = calculatePercentile(sortedTimes, 90);

      // Get aggregate stats
      const stats = await db.get(`
        SELECT
          COUNT(*) as total_views,
          AVG(load_time_ms) as avg_load_time,
          MIN(load_time_ms) as min_load_time,
          MAX(load_time_ms) as max_load_time,
          COUNT(load_time_ms) as views_with_timing
        FROM page_views
        WHERE DATE(created_at) = ?
      `, [date]);

      await db.run(`
        INSERT OR REPLACE INTO page_views_daily_summary (
          summary_date, total_views, avg_load_time, min_load_time, max_load_time,
          views_with_timing, p50_load_time, p90_load_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [date, stats.total_views, stats.avg_load_time, stats.min_load_time,
          stats.max_load_time, stats.views_with_timing, p50, p90]);

      dailyAggCount++;
    }

    logger.info(`  ✅ Aggregated ${dailyAggCount} daily summary records`);

    // Step 2: Aggregate path summaries with percentiles
    logger.info(`  📊 Aggregating path summaries before ${cutoffDateStr}...`);

    // Get all date/path combinations
    const pathGroups = await db.all(`
      SELECT DISTINCT DATE(created_at) as date, path
      FROM page_views
      WHERE DATE(created_at) < ?
      ORDER BY date, path
    `, [cutoffDateStr]);

    let pathAggCount = 0;
    for (const { date, path } of pathGroups) {
      // Get all load times for this date/path
      const loadTimes = await db.all(`
        SELECT load_time_ms
        FROM page_views
        WHERE DATE(created_at) = ? AND path = ? AND load_time_ms IS NOT NULL
        ORDER BY load_time_ms
      `, [date, path]);

      const sortedTimes = loadTimes.map(r => r.load_time_ms);
      const p50 = calculatePercentile(sortedTimes, 50);
      const p90 = calculatePercentile(sortedTimes, 90);

      const stats = await db.get(`
        SELECT
          COUNT(*) as total_views,
          AVG(load_time_ms) as avg_load_time,
          MIN(load_time_ms) as min_load_time,
          MAX(load_time_ms) as max_load_time,
          COUNT(load_time_ms) as views_with_timing
        FROM page_views
        WHERE DATE(created_at) = ? AND path = ?
      `, [date, path]);

      await db.run(`
        INSERT OR REPLACE INTO page_views_path_summary (
          summary_date, path, total_views, avg_load_time, min_load_time, max_load_time,
          views_with_timing, p50_load_time, p90_load_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [date, path, stats.total_views, stats.avg_load_time, stats.min_load_time,
          stats.max_load_time, stats.views_with_timing, p50, p90]);

      pathAggCount++;
    }

    const dailyAggResult = { changes: dailyAggCount };
    const pathAggResult = { changes: pathAggCount };

    logger.info(`  ✅ Aggregated ${pathAggResult.changes || 0} path summary records`);

    // Step 3: Count records to be deleted
    const countResult = await db.get(`
      SELECT COUNT(*) as count
      FROM page_views
      WHERE DATE(created_at) < ?
    `, [cutoffDateStr]);

    const recordsToDelete = countResult.count || 0;

    if (recordsToDelete === 0) {
      logger.info(`  ℹ️  No old page_views records to delete`);
      logger.info(`✅ Aggregation job completed in ${Date.now() - startTime}ms`);
      return {
        success: true,
        dailyRecords: dailyAggResult.changes || 0,
        pathRecords: pathAggResult.changes || 0,
        deletedRecords: 0,
        duration: Date.now() - startTime
      };
    }

    // Step 4: Delete aggregated records
    logger.info(`  🗑️  Deleting ${recordsToDelete} old page_views records...`);

    const deleteResult = await db.run(`
      DELETE FROM page_views
      WHERE DATE(created_at) < ?
    `, [cutoffDateStr]);

    logger.info(`  ✅ Deleted ${deleteResult.changes || 0} old page_views records`);

    // Step 5: Vacuum to reclaim space (optional, can be slow)
    logger.info(`  🧹 Running VACUUM to reclaim space...`);
    await db.run(`VACUUM`);
    logger.info(`  ✅ VACUUM completed`);

    const duration = Date.now() - startTime;
    logger.info(`✅ Aggregation job completed successfully in ${duration}ms`);
    logger.info(`   Daily summaries: ${dailyAggResult.changes || 0}`);
    logger.info(`   Path summaries: ${pathAggResult.changes || 0}`);
    logger.info(`   Records deleted: ${deleteResult.changes || 0}`);

    return {
      success: true,
      dailyRecords: dailyAggResult.changes || 0,
      pathRecords: pathAggResult.changes || 0,
      deletedRecords: deleteResult.changes || 0,
      duration
    };

  } catch (error) {
    logger.error(`❌ Error during page_views aggregation:`, error);
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Schedule the aggregation job
 * @param {object} db - Database instance
 * @param {string} schedule - Cron schedule (default: '0 2 * * *' = 2 AM daily)
 * @param {number} retentionDays - Number of days to keep detailed data
 */
function schedulePageViewsAggregation(db, schedule = '0 2 * * *', retentionDays = 30) {
  // Try to use node-cron if available
  try {
    const cron = require('node-cron');

    logger.info(`📅 Scheduling page_views aggregation job: ${schedule}`);

    const task = cron.schedule(schedule, async () => {
      await aggregateOldPageViews(db, retentionDays);
    });

    logger.info(`✅ Page_views aggregation job scheduled successfully`);

    return task;
  } catch (err) {
    // Fallback to simple interval (run once per day)
    logger.warn(`⚠️  node-cron not available, using interval-based scheduling`);

    const runDaily = async () => {
      await aggregateOldPageViews(db, retentionDays);
      // Schedule next run in 24 hours
      setTimeout(runDaily, 24 * 60 * 60 * 1000);
    };

    // Run once on startup, then every 24 hours
    logger.info(`📅 Scheduling page_views aggregation job (24h interval)`);
    setTimeout(runDaily, 24 * 60 * 60 * 1000);
    logger.info(`✅ Page_views aggregation job scheduled successfully`);

    return null;
  }
}

module.exports = {
  aggregateOldPageViews,
  schedulePageViewsAggregation
};
