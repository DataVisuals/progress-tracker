#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';

async function test() {
  console.log('Testing with postcode E1W3PG...\n');

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

  console.log('4. Waiting for results (20 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  console.log('5. Extracting results...');

  // Try to find the results container and extract data
  const results = await page.evaluate(() => {
    // Look for result count text
    const bodyText = document.body.textContent;
    const showingMatch = bodyText.match(/Showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i);
    const resultsInfo = showingMatch ? {
      showing: `${showingMatch[1]}-${showingMatch[2]}`,
      total: showingMatch[3]
    } : null;

    // Try to find individual nutritionist cards
    // The results might be in divs, articles, or list items
    const allElements = Array.from(document.querySelectorAll('div, article, li'));
    const nutritionists = [];

    allElements.forEach(el => {
      const text = el.textContent || '';

      // Look for elements that contain nutritionist info
      if ((text.includes('RNutr') || text.includes('ANutr')) &&
          (text.includes('@') || text.includes('Registration'))) {

        // Try to extract details
        const nameMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        const regMatch = text.match(/Registration.*?(\d{4,})/i);
        const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        const categoryMatch = text.match(/(RNutr|ANutr)/);

        if (nameMatch || regMatch) {
          nutritionists.push({
            name: nameMatch ? nameMatch[1] : '',
            registrationNumber: regMatch ? regMatch[1] : '',
            category: categoryMatch ? categoryMatch[1] : '',
            email: emailMatch ? emailMatch[1] : '',
            rawText: text.substring(0, 300)
          });
        }
      }
    });

    // Remove duplicates based on registration number or name
    const unique = nutritionists.filter((item, index, self) =>
      index === self.findIndex(t =>
        (t.registrationNumber && t.registrationNumber === item.registrationNumber) ||
        (t.name && t.name === item.name)
      )
    );

    return {
      resultsInfo,
      count: unique.length,
      nutritionists: unique.slice(0, 10), // First 10 for preview
      pageText: bodyText.substring(0, 1000)
    };
  });

  console.log('\n=== RESULTS ===');
  console.log('Results info:', results.resultsInfo);
  console.log('Found nutritionists:', results.count);
  console.log('\nFirst 10 nutritionists:');
  console.log(JSON.stringify(results.nutritionists, null, 2));
  console.log('\nPage text sample:', results.pageText);

  // Save screenshot
  await page.screenshot({ path: 'test-e1w3pg-results.png', fullPage: true });
  console.log('\nScreenshot saved: test-e1w3pg-results.png');

  // Save results to file
  fs.writeFileSync('test-e1w3pg-results.json', JSON.stringify(results, null, 2));
  console.log('Results saved: test-e1w3pg-results.json');

  console.log('\nBrowser staying open for 30 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
}

test().catch(console.error);
