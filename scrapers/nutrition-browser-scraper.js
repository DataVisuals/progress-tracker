#!/usr/bin/env node

/**
 * Association for Nutrition Register Scraper (Browser-based)
 *
 * Uses Puppeteer to interact with the actual web form to scrape nutritionist data.
 * This approach is more reliable than direct API calls and handles any client-side
 * JavaScript or security measures.
 *
 * NOTE: The AfN register states it should not be used for commercial purposes.
 * This scraper is for educational/research purposes only.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

// Configuration
const CONFIG = {
  searchUrl: 'https://www.associationfornutrition.org/register/search-the-register',
  radius: '50', // miles - use maximum for broadest coverage
  perPage: '50', // results per page
  outputFile: 'nutritionists.json',
  coverageFile: 'coverage-stats.json',
  delay: 2000, // delay between postcodes in ms
  headless: true // set to false to see browser
};

// UK postcodes for geographical spread
const UK_POSTCODES = [
  // England - London and South East
  'SW1A 1AA', 'E1 6AN', 'N1 9AG', 'W1A 1AA', 'SE1 7PB',
  'BR1 1JG', 'GU1 1AA', 'RH1 1AA', 'BN1 1AA',
  // England - South West
  'BS1 1AA', 'EX1 1AA', 'PL1 1AA', 'BA1 1AA',
  // England - Midlands
  'B1 1AA', 'NG1 1AA', 'LE1 1AA', 'CV1 1AA', 'DE1 1AA',
  // England - East
  'CB1 1AA', 'IP1 1AA', 'NR1 1AA', 'PE1 1AA',
  // England - North West
  'M1 1AA', 'L1 1AA', 'PR1 1AA', 'CH1 1AA',
  // England - North East
  'LS1 1AA', 'S1 1AA', 'NE1 1AA', 'DL1 1AA', 'YO1 7AA',
  // Scotland
  'G1 1AA', 'EH1 1AA', 'AB10 1AA', 'DD1 1AA', 'IV1 1AA',
  // Wales
  'CF10 1AA', 'SA1 1AA', 'LL11 1AA',
  // Northern Ireland
  'BT1 1AA', 'BT48 6AA',
];

// Store all unique nutritionists
const nutritionists = new Map();

// Coverage statistics
const stats = {
  totalSearches: 0,
  totalResults: 0,
  uniqueNutritionists: 0,
  postcodesSearched: [],
  errors: []
};

/**
 * Extract nutritionist data from the results on the page
 */
async function extractResultsFromPage(page) {
  return await page.evaluate(() => {
    const results = [];
    const resultCards = document.querySelectorAll('.registrant-card, .search-result, .nutritionist-result, [data-registrant]');

    // If no results found with specific selectors, try to find any container that looks like results
    const possibleContainers = resultCards.length > 0 ? resultCards : document.querySelectorAll('.result, .entry, article');

    possibleContainers.forEach(card => {
      const result = {
        name: '',
        registrationNumber: '',
        category: '',
        email: '',
        website: '',
        phone: '',
        services: [],
        areas: [],
        location: ''
      };

      // Try to extract name
      const nameEl = card.querySelector('.name, .registrant-name, h3, h4, .title');
      if (nameEl) result.name = nameEl.textContent.trim();

      // Try to extract registration number
      const regNumEl = card.querySelector('.registration-number, .reg-number, .reg-num');
      const regNumMatch = card.textContent.match(/Registration\s*(?:Number|#)?\s*:?\s*(\d+)/i);
      if (regNumEl) {
        result.registrationNumber = regNumEl.textContent.replace(/[^\d]/g, '');
      } else if (regNumMatch) {
        result.registrationNumber = regNumMatch[1];
      }

      // Try to extract category (ANutr, RNutr)
      const categoryMatch = card.textContent.match(/(ANutr|RNutr)/);
      if (categoryMatch) result.category = categoryMatch[1];

      // Try to extract email
      const emailEl = card.querySelector('a[href^="mailto:"]');
      if (emailEl) result.email = emailEl.textContent.trim();

      // Try to extract website
      const websiteEl = card.querySelector('a[href^="http"]:not([href*="mailto"]):not([href*="twitter"]):not([href*="linkedin"])');
      if (websiteEl) result.website = websiteEl.href;

      // Try to extract phone
      const phoneEl = card.querySelector('.phone, .telephone, a[href^="tel:"]');
      if (phoneEl) result.phone = phoneEl.textContent.trim();

      // Only add if we have at least a name or registration number
      if (result.name || result.registrationNumber) {
        results.push(result);
      }
    });

    return results;
  });
}

/**
 * Get total number of results from the page
 */
async function getTotalResults(page) {
  return await page.evaluate(() => {
    // Look for text like "Showing 1-50 of 234"
    const totalText = document.body.textContent.match(/of\s+(\d+)/i);
    if (totalText) return parseInt(totalText[1]);

    // Or look for result count element
    const countEl = document.querySelector('.total-results, .result-count, .count');
    if (countEl) {
      const match = countEl.textContent.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }

    return 0;
  });
}

/**
 * Check if there's a next page button
 */
async function hasNextPage(page) {
  return await page.evaluate(() => {
    const nextButton = document.querySelector('.next-page, .pagination .next, a[rel="next"]');
    return nextButton && !nextButton.classList.contains('disabled');
  });
}

/**
 * Click the next page button
 */
async function goToNextPage(page) {
  await page.evaluate(() => {
    const nextButton = document.querySelector('.next-page, .pagination .next, a[rel="next"]');
    if (nextButton) nextButton.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for results to load
}

/**
 * Search for nutritionists by postcode
 */
async function searchPostcode(page, postcode) {
  console.log(`\nSearching postcode: ${postcode} (${CONFIG.radius} mile radius)`);

  try {
    // Navigate to the search page
    await page.goto(CONFIG.searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the form to be present
    await page.waitForSelector('form, input[name="postcode"], #postcode', { timeout: 10000 });

    // Fill in the postcode
    const postcodeInput = await page.$('input[name="postcode"], #postcode, input[placeholder*="postcode" i]');
    if (!postcodeInput) {
      throw new Error('Could not find postcode input field');
    }
    await postcodeInput.click({ clickCount: 3 }); // Select all
    await postcodeInput.type(postcode);

    // Select radius
    const radiusSelect = await page.$('select[name="radius"], #radius, select[name="distance"]');
    if (radiusSelect) {
      await radiusSelect.select(CONFIG.radius);
    }

    // Select results per page
    const perPageSelect = await page.$('select[name="perPage"], #perPage, select[name="limit"]');
    if (perPageSelect) {
      await perPageSelect.select(CONFIG.perPage);
    }

    // Submit the form
    const submitButton = await page.$('button[type="submit"], input[type="submit"], .search-submit');
    if (!submitButton) {
      throw new Error('Could not find submit button');
    }
    await submitButton.click();

    // Wait for results to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get total results
    const total = await getTotalResults(page);
    console.log(`  Found ${total} results`);

    let allResults = [];
    let pageNum = 1;

    // Extract results from all pages
    do {
      if (pageNum > 1) {
        console.log(`  Loading page ${pageNum}...`);
      }

      const pageResults = await extractResultsFromPage(page);
      allResults = allResults.concat(pageResults);

      const hasNext = await hasNextPage(page);
      if (hasNext) {
        await goToNextPage(page);
        pageNum++;
      } else {
        break;
      }
    } while (pageNum < 100); // Safety limit

    // Process results
    let newCount = 0;
    allResults.forEach(person => {
      const key = person.registrationNumber || `${person.name}-${person.email}`;
      if (key && !nutritionists.has(key)) {
        nutritionists.set(key, person);
        newCount++;
      }
    });

    console.log(`  Added ${newCount} new nutritionists (${allResults.length - newCount} duplicates)`);

    stats.totalResults += total;
    stats.postcodesSearched.push(postcode);

  } catch (error) {
    console.error(`  ❌ Error searching ${postcode}:`, error.message);
    stats.errors.push({ postcode, error: error.message });
  }
}

/**
 * Save results to files
 */
function saveResults() {
  const data = Array.from(nutritionists.values());
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));

  stats.uniqueNutritionists = nutritionists.size;
  stats.totalSearches = stats.postcodesSearched.length;
  fs.writeFileSync(CONFIG.coverageFile, JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`✓ Postcodes searched: ${stats.totalSearches}`);
  console.log(`✓ Total results found: ${stats.totalResults}`);
  console.log(`✓ Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`✓ Duplicate entries: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`✓ Errors: ${stats.errors.length}`);
  console.log(`\nData saved to: ${CONFIG.outputFile}`);
  console.log(`Stats saved to: ${CONFIG.coverageFile}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Association for Nutrition Register Scraper (Browser-based)');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  - Radius: ${CONFIG.radius} miles`);
  console.log(`  - Results per page: ${CONFIG.perPage}`);
  console.log(`  - Postcodes to search: ${UK_POSTCODES.length}`);
  console.log(`  - Delay between requests: ${CONFIG.delay}ms`);

  // Test mode
  const testMode = process.argv.includes('--test');
  const postcodesToSearch = testMode ? [UK_POSTCODES[0]] : UK_POSTCODES;

  if (testMode) {
    console.log('\n🧪 TEST MODE: Searching only first postcode');
  }

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Search each postcode
  for (const postcode of postcodesToSearch) {
    await searchPostcode(page, postcode);
    if (!testMode) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delay));
    }
  }

  await browser.close();

  // Save results
  saveResults();
}

// Run the scraper
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
