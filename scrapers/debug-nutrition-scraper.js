#!/usr/bin/env node

/**
 * Debug version of the nutrition scraper
 * Saves screenshots to help diagnose issues
 */

import puppeteer from 'puppeteer';

async function debug() {
  console.log('Debugging Association for Nutrition scraper...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('1. Navigating to search page...');
  try {
    await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('   ✓ Page loaded');
  } catch (error) {
    console.log('   ✗ Failed to load:', error.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
    await browser.close();
    return;
  }

  await page.screenshot({ path: 'debug-1-initial.png', fullPage: true });

  console.log('\n2. Page HTML structure:');
  const html = await page.evaluate(() => {
    return {
      forms: document.querySelectorAll('form').length,
      inputs: Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder
      })),
      selects: Array.from(document.querySelectorAll('select')).map(s => ({
        name: s.name,
        id: s.id
      })),
      buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => ({
        type: b.type,
        text: b.textContent?.trim() || b.value
      }))
    };
  });
  console.log(JSON.stringify(html, null, 2));

  console.log('\n3. Looking for postcode input...');
  const postcodeSelectors = [
    'input[name="postcode"]',
    '#postcode',
    'input[placeholder*="postcode" i]',
    'input[type="text"]'
  ];

  let postcodeInput = null;
  for (const selector of postcodeSelectors) {
    try {
      postcodeInput = await page.$(selector);
      if (postcodeInput) {
        console.log(`   ✓ Found postcode input: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!postcodeInput) {
    console.log('   ✗ Could not find postcode input');
    await browser.close();
    return;
  }

  console.log('\n4. Filling in postcode...');
  await postcodeInput.click({ clickCount: 3 });
  await postcodeInput.type('SW1A 1AA');
  await page.screenshot({ path: 'debug-2-filled.png', fullPage: true });
  console.log('   ✓ Postcode filled');

  console.log('\n5. Looking for submit button...');
  const submitButton = await page.$('button[type="submit"], input[type="submit"]');
  if (!submitButton) {
    console.log('   ✗ Could not find submit button');
    await browser.close();
    return;
  }

  console.log('   ✓ Found submit button');
  console.log('\n6. Submitting form...');
  await submitButton.click();

  console.log('   Waiting for response...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  await page.screenshot({ path: 'debug-3-results.png', fullPage: true });

  console.log('\n7. Checking for results...');
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.textContent.substring(0, 500),
      resultElements: {
        'div.registrant': document.querySelectorAll('div.registrant').length,
        'div.result': document.querySelectorAll('div.result').length,
        'div.search-result': document.querySelectorAll('div.search-result').length,
        'article': document.querySelectorAll('article').length,
        'div[data-registrant]': document.querySelectorAll('div[data-registrant]').length,
      }
    };
  });
  console.log(JSON.stringify(pageContent, null, 2));

  console.log('\n8. Extracting all text content that might contain results...');
  const allText = await page.evaluate(() => document.body.textContent);
  console.log('Text length:', allText.length);
  console.log('First 1000 chars:', allText.substring(0, 1000));

  console.log('\n✓ Debug complete. Check the screenshots:');
  console.log('  - debug-1-initial.png: Initial page load');
  console.log('  - debug-2-filled.png: After filling in postcode');
  console.log('  - debug-3-results.png: After submitting search');

  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
}

debug().catch(console.error);
