#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';

async function test() {
  console.log('Simple test: 10 results, 90 second wait\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  // Make it look more like a real browser
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  console.log('1. Loading page...');
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  console.log('2. Waiting 5 seconds for page to settle...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('3. Filling form (10 results per page)...');
  await page.type('input[name="postcode"]', 'E1W 3PG', { delay: 100 });
  await new Promise(resolve => setTimeout(resolve, 500));

  await page.select('select[name="postcode_radius"]', '50');
  await new Promise(resolve => setTimeout(resolve, 500));

  await page.select('select[name="per_page"]', '10');  // Reduced from 50
  await new Promise(resolve => setTimeout(resolve, 500));

  await page.screenshot({ path: 'simple-before-submit.png', fullPage: true });

  console.log('4. Submitting form...');
  await page.click('button[type="submit"]');

  console.log('5. Waiting 90 seconds for results...');

  // Check every 10 seconds
  for (let i = 1; i <= 9; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`   ... ${i * 10} seconds elapsed`);

    const stillSearching = await page.evaluate(() => {
      const text = document.body.textContent;
      return {
        hasSearching: text.includes('Searching'),
        hasShowing: text.includes('Showing'),
        hasResults: text.includes('results'),
        textLength: text.length
      };
    });

    console.log(`      Status:`, JSON.stringify(stillSearching));

    if (!stillSearching.hasSearching && (stillSearching.hasShowing || stillSearching.textLength > 35000)) {
      console.log('   ✓ Results appear to have loaded!');
      break;
    }
  }

  await page.screenshot({ path: 'simple-after-wait.png', fullPage: true });

  console.log('\n6. Analyzing results...');
  const analysis = await page.evaluate(() => {
    const bodyText = document.body.textContent;

    // Look for result indicators
    const showingMatch = bodyText.match(/Showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i);
    const resultsMatch = bodyText.match(/(\d+)\s+results?/i);

    // Try to find result elements
    const allDivs = Array.from(document.querySelectorAll('div'));
    const potentialResults = allDivs.filter(div => {
      const text = div.textContent || '';
      // Look for nutritionist-specific content
      return (
        (text.includes('RNutr') || text.includes('ANutr')) &&
        text.length > 50 &&
        text.length < 2000 &&
        !text.includes('Search the Register')
      );
    });

    return {
      textLength: bodyText.length,
      stillSearching: bodyText.includes('Searching'),
      showingMatch: showingMatch ? showingMatch[0] : null,
      resultsMatch: resultsMatch ? resultsMatch[0] : null,
      potentialResultElements: potentialResults.length,
      sampleText: bodyText.substring(bodyText.indexOf('Search') + 100, bodyText.indexOf('Search') + 500)
    };
  });

  console.log(JSON.stringify(analysis, null, 2));

  // Save full page text
  const fullText = await page.evaluate(() => document.body.textContent);
  fs.writeFileSync('simple-page-text.txt', fullText);
  console.log('\nFull page text saved to: simple-page-text.txt');

  console.log('\n7. Keeping browser open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();

  return analysis;
}

test()
  .then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log('Success:', !result.stillSearching && result.textLength > 35000);
  })
  .catch(console.error);
