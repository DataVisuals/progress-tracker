const cron = require('node-cron');
const { exportAllData } = require('./exportService');

/**
 * Schedule daily export at midnight GMT
 * Cron pattern: '0 0 * * *' = At 00:00 (midnight) every day
 */
function startScheduler() {
  console.log('📅 Scheduler initialized');

  // Schedule for midnight GMT (00:00 UTC)
  const task = cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Scheduled export triggered at midnight GMT');
    try {
      await exportAllData();
    } catch (err) {
      console.error('Error in scheduled export:', err);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('✅ Daily export scheduled for midnight GMT (00:00 UTC)');

  return task;
}

module.exports = {
  startScheduler
};
