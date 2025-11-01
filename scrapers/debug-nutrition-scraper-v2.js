#!/usr/bin/env node

/**
 * Debug version 2 - with proper AJAX waiting
 */

import puppeteer from 'puppeteer';

async function debug() {
  console.log('Debugging Association for Nutrition scraper v2...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('1. Navigating to search page...');
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  console.log('   ✓ Page loaded');

  console.log('\n2. Filling in form...');
  await page.type('input[name="postcode"]', 'SW1A 1AA');

  // Select radius
  await page.select('select[name="postcode_radius"]', '50');

  // Select per page
  await page.select('select[name="per_page"]', '50');

  console.log('   ✓ Form filled');
  await page.screenshot({ path: 'debug-v2-1-filled.png', fullPage: true });

  console.log('\n3. Submitting form and waiting for results...');

  // Set up request/response monitoring
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('afn/registrants/search') || url.includes('search')) {
      console.log('   📡 API Response:', response.status(), url);
    }
  });

  await page.click('button[type="submit"]');
  console.log('   ✓ Form submitted, waiting for AJAX...');

  // Wait for network activity to settle
  await page.waitForNetworkIdle({ timeout: 15000, idleTime: 2000 }).catch(() => {
    console.log('   ⚠️  Network idle timeout (this is OK)');
  });

  console.log('   Waiting additional 5 seconds for rendering...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  await page.screenshot({ path: 'debug-v2-2-after-submit.png', fullPage: true });

  console.log('\n4. Checking page content...');
  const check1 = await page.evaluate(() => {
    // Look for common result indicators
    const indicators = {
      searchingText: document.body.textContent.includes('Searching'),
      noResultsText: document.body.textContent.includes('No results') || document.body.textContent.includes('0 results'),
      resultCountMatch: document.body.textContent.match(/(\d+)\s+results?/i),
      showingMatch: document.body.textContent.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i),
    };

    return indicators;
  });
  console.log('   Indicators:', JSON.stringify(check1, null, 2));

  console.log('\n5. Looking for result container elements...');
  const containers = await page.evaluate(() => {
    const selectors = [
      '#results',
      '.results',
      '#registrants',
      '.registrants',
      '#search-results',
      '.search-results',
      '[id*="result"]',
      '[class*="result"]',
      '[id*="registrant"]',
      '[class*="registrant"]'
    ];

    const found = {};
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        found[sel] = {
          innerHTML: el.innerHTML.substring(0, 500),
          textContent: el.textContent.substring(0, 200)
        };
      }
    });

    return found;
  });
  console.log('   Found containers:', Object.keys(containers));
  console.log(JSON.stringify(containers, null, 2));

  console.log('\n6. Extracting ALL divs to find results pattern...');
  const allDivs = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    return divs
      .filter(div => {
        const text = div.textContent;
        // Look for divs that might contain nutritionist info
        return text.includes('RNutr') || text.includes('ANutr') ||
               text.includes('@') || text.includes('Registration');
      })
      .slice(0, 5) // Just first 5 matches
      .map(div => ({
        className: div.className,
        id: div.id,
        text: div.textContent.substring(0, 300),
        html: div.innerHTML.substring(0, 300)
      }));
  });
  console.log('   Potential result divs:', JSON.stringify(allDivs, null, 2));

  console.log('\n7. Checking for pagination or result info...');
  const pageInfo = await page.evaluate(() => {
    return {
      allText: document.body.textContent.substring(0, 2000)
    };
  });
  console.log('   Page text sample:', pageInfo.allText);

  console.log('\n✓ Debug complete. Screenshots saved:');
  console.log('  - debug-v2-1-filled.png');
  console.log('  - debug-v2-2-after-submit.png');

  console.log('\nBrowser staying open for 60 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
}

debug().catch(console.error);
