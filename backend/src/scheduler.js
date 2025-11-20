const cron = require('node-cron');
const { exportAllData } = require('./exportService');

/**
 * Schedule daily export at midnight GMT
 * Cron pattern: '0 0 * * *' = At 00:00 (midnight) every day
 */
function startScheduler(generateConsistencyFeedback) {
  console.log('📅 Scheduler initialized');

  // Schedule for midnight GMT (00:00 UTC)
  const exportTask = cron.schedule('0 0 * * *', async () => {
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

  // Schedule consistency feedback generation at midnight GMT (00:00 UTC)
  if (generateConsistencyFeedback) {
    const feedbackTask = cron.schedule('0 0 * * *', async () => {
      console.log('⏰ Scheduled consistency feedback generation triggered at midnight GMT');
      try {
        const result = await generateConsistencyFeedback();
        console.log(`✅ Scheduled consistency feedback: ${result.created} created, ${result.skipped} skipped`);
      } catch (err) {
        console.error('Error in scheduled consistency feedback generation:', err);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log('✅ Daily consistency feedback generation scheduled for midnight GMT (00:00 UTC)');

    return { exportTask, feedbackTask };
  }

  return { exportTask };
}

module.exports = {
  startScheduler
};
