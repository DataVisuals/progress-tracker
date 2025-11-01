#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';

async function test() {
  console.log('Testing with E1W 3PG and 60+ second wait...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('1. Loading page...');
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('2. Filling form with E1W 3PG...');
  await page.type('input[name="postcode"]', 'E1W 3PG');
  await page.select('select[name="postcode_radius"]', '50');
  await page.select('select[name="per_page"]', '50');

  console.log('3. Submitting...');
  await page.click('button[type="submit"]');

  console.log('4. Waiting for results (60 seconds)...');
  // Wait in 10-second intervals, checking for results
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`   ... ${(i + 1) * 10} seconds elapsed`);

    // Check if "Searching..." is still present
    const stillSearching = await page.evaluate(() => {
      return document.body.textContent.includes('Searching');
    });

    if (!stillSearching) {
      console.log('   ✓ Results appear to have loaded!');
      break;
    }
  }

  console.log('\n5. Examining page structure for results...');

  const pageAnalysis = await page.evaluate(() => {
    // Look for a results container that might have been populated
    const results = {
      fullBodyText: document.body.textContent,
      // Check for common result container IDs/classes
      possibleContainers: {}
    };

    const selectors = [
      '#results',
      '#search-results',
      '.results',
      '.search-results',
      '#registrants',
      '.registrants',
      '[class*="registrant"]',
      'main',
      '.main-content',
      '#main-content'
    ];

    selectors.forEach(sel => {
      try {
        const el = document.querySelector(sel);
        if (el) {
          results.possibleContainers[sel] = {
            exists: true,
            textLength: el.textContent.length,
            childCount: el.children.length,
            innerHTML: el.innerHTML.substring(0, 1000)
          };
        }
      } catch (e) {}
    });

    return results;
  });

  // Save the full page text to examine
  fs.writeFileSync('page-full-text.txt', pageAnalysis.fullBodyText);
  console.log('   Full page text saved to: page-full-text.txt');
  console.log('   Text length:', pageAnalysis.fullBodyText.length);

  console.log('\n6. Possible result containers found:');
  console.log(JSON.stringify(pageAnalysis.possibleContainers, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'test-longer-wait.png', fullPage: true });
  console.log('\n7. Screenshot saved: test-longer-wait.png');

  // Search for actual nutritionist data patterns in the text
  console.log('\n8. Searching for nutritionist patterns in page text...');
  const regNums = pageAnalysis.fullBodyText.match(/Registration.*?(\d{4,})/gi) || [];
  console.log(`   Found ${regNums.length} potential registration numbers`);
  console.log('   Examples:', regNums.slice(0, 5));

  console.log('\nBrowser staying open for 60 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
}

test().catch(console.error);
