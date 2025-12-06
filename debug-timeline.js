import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Navigate to the app
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  // Wait a bit for any animations
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Take initial screenshot
  await page.screenshot({ path: 'timeline-initial.png', fullPage: false });
  console.log('📸 Initial screenshot saved: timeline-initial.png');

  // Check if timeline is visible
  let timelineExists = await page.$('.timeline-container');
  if (!timelineExists) {
    console.log('Timeline not visible, need to enable it via settings...');

    // Click the dashboard config button
    try {
      await page.click('.dashboard-config-btn');
      console.log('✓ Clicked settings button');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.screenshot({ path: 'settings-modal-open.png', fullPage: false });
      console.log('📸 Settings modal screenshot saved');

      // Click on the timeline panel in the modal
      const timelineButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('.panel-option, button'));
        return buttons.find(btn => btn.textContent?.includes('Project Timeline'));
      });

      if (timelineButton) {
        await timelineButton.click();
        console.log('✓ Selected timeline panel');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Close modal or save - look for save/apply button
      const saveButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent?.match(/save|apply|ok/i));
      });

      if (saveButton) {
        await saveButton.click();
        console.log('✓ Saved configuration');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      timelineExists = await page.$('.timeline-container');
    } catch (e) {
      console.log('Error configuring timeline:', e.message);
    }
  }

  // Get computed styles for key elements
  const styles = await page.evaluate(() => {
    const results = {};

    // Find timeline elements
    const axisSticky = document.querySelector('.timeline-axis-sticky');
    const axisLabelSpacer = document.querySelector('.timeline-axis-label-spacer');
    const projectLabel = document.querySelector('.timeline-project-label');
    const axisCountdownSpacer = document.querySelector('.timeline-axis-countdown-spacer');

    if (axisSticky) {
      const computed = window.getComputedStyle(axisSticky);
      results.axisSticky = {
        zIndex: computed.zIndex,
        position: computed.position,
        top: computed.top,
        background: computed.background
      };
    }

    if (axisLabelSpacer) {
      const computed = window.getComputedStyle(axisLabelSpacer);
      results.axisLabelSpacer = {
        zIndex: computed.zIndex,
        position: computed.position,
        left: computed.left,
        background: computed.background
      };
    }

    if (projectLabel) {
      const computed = window.getComputedStyle(projectLabel);
      results.projectLabel = {
        zIndex: computed.zIndex,
        position: computed.position,
        left: computed.left,
        background: computed.background
      };
    }

    if (axisCountdownSpacer) {
      const computed = window.getComputedStyle(axisCountdownSpacer);
      results.axisCountdownSpacer = {
        zIndex: computed.zIndex,
        position: computed.position,
        right: computed.right,
        background: computed.background
      };
    }

    return results;
  });

  console.log('\n📊 Computed Styles:');
  console.log(JSON.stringify(styles, null, 2));

  // Scroll down in the timeline to test overlap
  const scrollContainer = await page.$('.timeline-scroll-wrapper');
  if (scrollContainer) {
    await page.evaluate((element) => {
      element.scrollTop = 200;
    }, scrollContainer);

    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'timeline-scrolled.png', fullPage: false });
    console.log('📸 Scrolled screenshot saved: timeline-scrolled.png');
  }

  // Scroll horizontally too
  if (scrollContainer) {
    await page.evaluate((element) => {
      element.scrollLeft = 300;
    }, scrollContainer);

    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: 'timeline-scrolled-horizontal.png', fullPage: false });
    console.log('📸 Horizontal scroll screenshot saved: timeline-scrolled-horizontal.png');
  }

  console.log('\n✅ Debug complete! Check the screenshots and style output above.');

  await browser.close();
})();
